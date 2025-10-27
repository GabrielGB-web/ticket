const { 
    ChannelType, 
    PermissionsBitField, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    EmbedBuilder, 
    StringSelectMenuBuilder, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle 
} = require('discord.js');

const ticketDB = new Map();
const suggestionsDB = new Map();

module.exports = {
    name: 'interactionCreate',
    async execute(interaction) {
        console.log(`🔹 Interação recebida: ${interaction.type} | ${interaction.customId || interaction.commandName}`);

        // Comandos de slash
        if (interaction.isChatInputCommand()) {
            const command = interaction.client.commands.get(interaction.commandName);

            if (!command) {
                console.log(`❌ Comando não encontrado: ${interaction.commandName}`);
                return interaction.reply({ 
                    content: '❌ Comando não encontrado!', 
                    flags: 64 
                });
            }

            try {
                console.log(`▶️ Executando comando: ${interaction.commandName}`);
                await command.execute(interaction);
                console.log(`✅ Comando executado: ${interaction.commandName}`);
            } catch (error) {
                console.error(`❌ Erro ao executar comando ${interaction.commandName}:`, error);
                await interaction.reply({ 
                    content: '❌ Ocorreu um erro ao executar este comando!', 
                    flags: 64 
                });
            }
            return;
        }

        // Botão fixo para abrir menu de tickets
        if (interaction.isButton() && interaction.customId === 'open-ticket-menu') {
            await handleTicketMenu(interaction);
            return;
        }

        // Menu de seleção de tipo de ticket
        if (interaction.isStringSelectMenu() && interaction.customId === 'ticket-select') {
            await handleTicketCreation(interaction);
            return;
        }

        // Botões dentro do ticket
        if (interaction.isButton() && [
            'notify-user', 
            'add-member', 
            'claim-ticket', 
            'close-ticket',
            'transcript-ticket'
        ].includes(interaction.customId)) {
            await handleTicketButtons(interaction);
            return;
        }

        // Modal para adicionar membro
        if (interaction.isModalSubmit() && interaction.customId === 'add-member-modal') {
            await handleAddMemberModal(interaction);
            return;
        }

        // Botões de votação nas sugestões
        if (interaction.isButton() && [
            'suggestion-upvote',
            'suggestion-downvote',
            'suggestion-approve',
            'suggestion-deny'
        ].includes(interaction.customId)) {
            await handleSuggestionVote(interaction);
            return;
        }
    }
};

async function handleTicketMenu(interaction) {
    const embed = new EmbedBuilder()
        .setTitle('🎫 Sistema de Tickets')
        .setDescription('Selecione abaixo o tipo de ticket que deseja abrir:')
        .setColor(0x0099FF)
        .addFields(
            { name: '🚨 Denúncias', value: 'Fazer denúncia ou recorrer a uma denúncia' },
            { name: '❓ Suporte', value: 'Tirar dúvidas ou recorrer a banimento de anti cheat' },
            { name: '🛒 Loja', value: 'Assuntos sobre compra na loja' },
            { name: '👑 Falar com CEO', value: 'Comunicação direta com a administração' }
        )
        .setFooter({ text: 'Clique no menu abaixo para selecionar' });

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('ticket-select')
        .setPlaceholder('Selecione o tipo de ticket')
        .addOptions([
            {
                label: 'Denúncias',
                description: 'Fazer denúncia ou recorrer a uma denúncia',
                value: 'denuncias',
                emoji: '🚨'
            },
            {
                label: 'Suporte',
                description: 'Tirar dúvidas ou recorrer a banimento',
                value: 'suporte',
                emoji: '❓'
            },
            {
                label: 'Loja',
                description: 'Assuntos sobre compra na loja',
                value: 'loja',
                emoji: '🛒'
            },
            {
                label: 'Falar com CEO',
                description: 'Comunicação direta com a administração',
                value: 'ceo',
                emoji: '👑'
            }
        ]);

    const row = new ActionRowBuilder().addComponents(selectMenu);

    await interaction.reply({ embeds: [embed], components: [row], flags: 64 });
}

async function handleTicketCreation(interaction) {
    const selectedOption = interaction.values[0];
    const user = interaction.user;
    const guild = interaction.guild;

    // CONFIGURAÇÃO DOS CARGOS E CANAL DE TRANSCRIPT
    const ticketConfigs = {
        denuncias: {
            name: '🚨・denúncia',
            categoryName: '🚨 Denúncias',
            staffRole: 'Staff Denúncias',
            staffRoleIds: [
                '1330959853644025858', // ← Ceo
                '1330959853644025864', // ← Diretor Geral
                '1330959853820182565',  // ← Administrador
                '1330959853820182566',  // ← Moderador
                '1330959853878771905'  // ← Equipe Denúncia
            ],
            color: 0xFF0000
        },
        suporte: {
            name: '❓・suporte',
            categoryName: '❓ Suporte',
            staffRole: 'Staff Suporte',
            staffRoleIds: [
                '1330959853644025858', // ← CEO
                '1330959853644025864', // ← Diretor Geral
                '1330959853820182567'  // ← Suporte
            ],
            color: 0x0099FF
        },
        loja: {
            name: '🛒・loja',
            categoryName: '🛒 Loja',
            staffRole: 'Staff Loja',
            staffRoleIds: [
                '1330959853644025858', // ← CEO
                '1330959853644025864'  // ← Diretor Geral
            ],
            color: 0xFFA500
        },
        ceo: {
            name: '👑・ceo',
            categoryName: '👑 CEO',
            staffRole: 'CEO',
            staffRoleIds: [
                '1330959853644025858',  // ← CEO
                '1330959853644025864' // ← Diretor Geral
            ],
            color: 0xFFD700
        }
    };

    // ID do canal para salvar transcripts
    const TRANSCRIPT_CHANNEL_ID = '1330959856185774175';

    const config = ticketConfigs[selectedOption];

    // Verificar se já existe ticket aberto
    const existingTicket = Array.from(ticketDB.values()).find(
        ticket => ticket.userId === user.id && ticket.guildId === guild.id && !ticket.closed
    );

    if (existingTicket) {
        return interaction.reply({ 
            content: '❌ Você já possui um ticket aberto! Por favor, aguarde o atendimento no ticket existente.', 
            flags: 64 
        });
    }

    try {
        // Encontrar ou criar categoria
        let category = guild.channels.cache.find(
            channel => channel.name === config.categoryName && channel.type === ChannelType.GuildCategory
        );

        if (!category) {
            category = await guild.channels.create({
                name: config.categoryName,
                type: ChannelType.GuildCategory,
                permissionOverwrites: [
                    {
                        id: guild.id,
                        deny: [PermissionsBitField.Flags.ViewChannel]
                    }
                ]
            });
        }

        // Criar canal do ticket
        const ticketChannel = await guild.channels.create({
            name: `${config.name}-${user.username}`.toLowerCase().slice(0, 100),
            type: ChannelType.GuildText,
            parent: category.id,
            topic: `Ticket de ${selectedOption} - Aberto por: ${user.tag} | ${new Date().toLocaleString('pt-BR')}`,
            permissionOverwrites: [
                {
                    id: guild.id,
                    deny: [PermissionsBitField.Flags.ViewChannel]
                },
                {
                    id: user.id,
                    allow: [
                        PermissionsBitField.Flags.ViewChannel,
                        PermissionsBitField.Flags.SendMessages,
                        PermissionsBitField.Flags.ReadMessageHistory,
                        PermissionsBitField.Flags.AttachFiles,
                        PermissionsBitField.Flags.EmbedLinks
                    ]
                }
            ]
        });

        // Adicionar permissões para staff (múltiplos cargos)
        if (config.staffRoleIds && config.staffRoleIds.length > 0) {
            for (const roleId of config.staffRoleIds) {
                const staffRole = guild.roles.cache.get(roleId);
                if (staffRole) {
                    await ticketChannel.permissionOverwrites.edit(staffRole, {
                        ViewChannel: true,
                        SendMessages: true,
                        ReadMessageHistory: true,
                        ManageMessages: true,
                        ManageChannels: true,
                        EmbedLinks: true,
                        AttachFiles: true
                    });
                    console.log(`✅ Permissões dadas para: ${staffRole.name}`);
                }
            }
        }

        // Salvar no banco de dados
        const ticketData = {
            channelId: ticketChannel.id,
            userId: user.id,
            guildId: guild.id,
            type: selectedOption,
            staffRole: config.staffRole,
            staffRoleIds: config.staffRoleIds,
            transcriptChannelId: TRANSCRIPT_CHANNEL_ID,
            closed: false,
            claimedBy: null,
            createdAt: new Date()
        };
        ticketDB.set(ticketChannel.id, ticketData);

        // Embed do ticket
        const ticketEmbed = new EmbedBuilder()
            .setTitle(`Ticket - ${selectedOption.toUpperCase()}`)
            .setDescription(`Olá ${user}! A equipe de suporte irá te ajudar em breve.\n\nPor favor, descreva seu problema detalhadamente.`)
            .addFields(
                { name: '👤 Aberto por', value: `${user.tag} (${user.id})`, inline: true },
                { name: '🎫 Tipo', value: selectedOption, inline: true },
                { name: '📅 Data', value: new Date().toLocaleString('pt-BR'), inline: true }
            )
            .setColor(config.color)
            .setFooter({ text: 'Sistema de Tickets - Aguarde atendimento' });

        // Botões para ações do ticket
        const buttons = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('notify-user')
                .setLabel('📢 Notificar')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('add-member')
                .setLabel('➕ Adicionar Membro')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('claim-ticket')
                .setLabel('👤 Assumir Ticket')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('transcript-ticket')
                .setLabel('📄 Transcript')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('close-ticket')
                .setLabel('🔒 Fechar')
                .setStyle(ButtonStyle.Danger)
        );

        // Criar menção para todos os cargos staff
        let roleMentions = '';
        if (config.staffRoleIds && config.staffRoleIds.length > 0) {
            roleMentions = config.staffRoleIds.map(roleId => `<@&${roleId}>`).join(' ');
        }

        await ticketChannel.send({ 
            content: `${user} ${roleMentions}\n**Ticket criado com sucesso!**`,
            embeds: [ticketEmbed], 
            components: [buttons] 
        });

        await interaction.reply({ 
            content: `✅ Ticket criado com sucesso! Acesse: ${ticketChannel}`, 
            flags: 64 
        });

    } catch (error) {
        console.error('Erro ao criar ticket:', error);
        await interaction.reply({ 
            content: '❌ Erro ao criar o ticket. Por favor, tente novamente ou contate um administrador.', 
            flags: 64 
        });
    }
}

// SISTEMA DE VOTAÇÃO PARA SUGESTÕES
async function handleSuggestionVote(interaction) {
    const messageId = interaction.message.id;
    const userId = interaction.user.id;
    const suggestionData = suggestionsDB.get(messageId);

    if (!suggestionData) {
        return await interaction.reply({ 
            content: '❌ Sugestão não encontrada.', 
            flags: 64 
        });
    }

    const isStaff = interaction.member.permissions.has(PermissionsBitField.Flags.ManageMessages);

    // Verificar se é ação de staff (aprovar/recusar)
    if (interaction.customId === 'suggestion-approve' || interaction.customId === 'suggestion-deny') {
        if (!isStaff) {
            return await interaction.reply({ 
                content: '❌ Apenas staff pode aprovar ou recusar sugestões.', 
                flags: 64 
            });
        }

        if (interaction.customId === 'suggestion-approve') {
            suggestionData.status = 'approved';
            suggestionData.reviewedBy = userId;
            suggestionData.reviewedAt = new Date();
            
            // Atualizar embed
            const originalEmbed = interaction.message.embeds[0];
            const approvedEmbed = new EmbedBuilder()
                .setTitle(originalEmbed.title)
                .setDescription(originalEmbed.description)
                .setColor(0x00FF00)
                .addFields(
                    { name: '👤 Sugerido por', value: originalEmbed.fields.find(f => f.name === '👤 Sugerido por')?.value || 'N/A', inline: true },
                    { name: '📅 Data', value: originalEmbed.fields.find(f => f.name === '📅 Data')?.value || 'N/A', inline: true },
                    { name: '📊 Votos', value: originalEmbed.fields.find(f => f.name === '📊 Votos')?.value || 'N/A', inline: true },
                    { name: '📝 Status', value: '✅ Aprovado', inline: true }
                )
                .setFooter(originalEmbed.footer ? { text: originalEmbed.footer.text } : null)
                .setTimestamp();

            await interaction.message.edit({ 
                embeds: [approvedEmbed],
                components: []
            });

            await interaction.reply({ 
                content: '✅ Sugestão aprovada com sucesso!', 
                flags: 64 
            });

        } else if (interaction.customId === 'suggestion-deny') {
            suggestionData.status = 'denied';
            suggestionData.reviewedBy = userId;
            suggestionData.reviewedAt = new Date();
            
            // Atualizar embed
            const originalEmbed = interaction.message.embeds[0];
            const deniedEmbed = new EmbedBuilder()
                .setTitle(originalEmbed.title)
                .setDescription(originalEmbed.description)
                .setColor(0xFF0000)
                .addFields(
                    { name: '👤 Sugerido por', value: originalEmbed.fields.find(f => f.name === '👤 Sugerido por')?.value || 'N/A', inline: true },
                    { name: '📅 Data', value: originalEmbed.fields.find(f => f.name === '📅 Data')?.value || 'N/A', inline: true },
                    { name: '📊 Votos', value: originalEmbed.fields.find(f => f.name === '📊 Votos')?.value || 'N/A', inline: true },
                    { name: '📝 Status', value: '❌ Recusado', inline: true }
                )
                .setFooter(originalEmbed.footer ? { text: originalEmbed.footer.text } : null)
                .setTimestamp();

            await interaction.message.edit({ 
                embeds: [deniedEmbed],
                components: []
            });

            await interaction.reply({ 
                content: '❌ Sugestão recusada.', 
                flags: 64 
            });
        }

        suggestionsDB.set(messageId, suggestionData);
        return;
    }

    // Sistema de votação para membros comuns
    if (suggestionData.status !== 'pending') {
        return await interaction.reply({ 
            content: '❌ Esta sugestão já foi revisada pela staff.', 
            flags: 64 
        });
    }

    const isUpvote = interaction.customId === 'suggestion-upvote';
    
    // Remover votos anteriores do usuário
    suggestionData.upvotes = suggestionData.upvotes.filter(id => id !== userId);
    suggestionData.downvotes = suggestionData.downvotes.filter(id => id !== userId);

    // Adicionar novo voto
    if (isUpvote) {
        suggestionData.upvotes.push(userId);
    } else {
        suggestionData.downvotes.push(userId);
    }

    // Atualizar embed com novos votos
    const originalEmbed = interaction.message.embeds[0];
    const updatedEmbed = new EmbedBuilder()
        .setTitle(originalEmbed.title)
        .setDescription(originalEmbed.description)
        .setColor(originalEmbed.color)
        .addFields(
            { name: '👤 Sugerido por', value: originalEmbed.fields.find(f => f.name === '👤 Sugerido por')?.value || 'N/A', inline: true },
            { name: '📅 Data', value: originalEmbed.fields.find(f => f.name === '📅 Data')?.value || 'N/A', inline: true },
            { name: '📊 Votos', value: `👍 ${suggestionData.upvotes.length} | 👎 ${suggestionData.downvotes.length}`, inline: true },
            { name: '📝 Status', value: originalEmbed.fields.find(f => f.name === '📝 Status')?.value || '⏳ Pendente', inline: true }
        )
        .setFooter(originalEmbed.footer ? { text: originalEmbed.footer.text } : null)
        .setTimestamp();

    await interaction.message.edit({ embeds: [updatedEmbed] });
    suggestionsDB.set(messageId, suggestionData);

    await interaction.reply({ 
        content: `✅ Seu voto ${isUpvote ? '👍' : '👎'} foi registrado!`, 
        flags: 64 
    });
}

async function handleTicketButtons(interaction) {
    const ticketData = ticketDB.get(interaction.channel.id);
    
    if (!ticketData) {
        return interaction.reply({ 
            content: '❌ Este canal não é um ticket válido ou os dados foram perdidos.', 
            flags: 64 
        });
    }

    // Verificar permissões (apenas staff pode usar os botões)
    let hasPermission = false;

    // Verificar por IDs dos cargos (múltiplos cargos)
    if (ticketData.staffRoleIds && ticketData.staffRoleIds.length > 0) {
        hasPermission = ticketData.staffRoleIds.some(roleId => 
            interaction.member.roles.cache.has(roleId)
        );
    }

    // Administradores sempre têm acesso
    if (!hasPermission) {
        hasPermission = interaction.member.permissions.has(PermissionsBitField.Flags.Administrator);
    }

    if (!hasPermission) {
        return interaction.reply({ 
            content: '❌ Você não tem permissão para usar este comando! Apenas staff pode usar os botões do ticket.', 
            flags: 64 
        });
    }

    switch (interaction.customId) {
        case 'notify-user':
            await notifyUser(interaction, ticketData);
            break;
        
        case 'add-member':
            await addMember(interaction, ticketData);
            break;
        
        case 'claim-ticket':
            await claimTicket(interaction, ticketData);
            break;

        case 'transcript-ticket':
            await transcriptTicket(interaction, ticketData);
            break;
        
        case 'close-ticket':
            await closeTicket(interaction, ticketData);
            break;
    }
}

async function notifyUser(interaction, ticketData) {
    try {
        const user = await interaction.guild.members.fetch(ticketData.userId);
        const notifyEmbed = new EmbedBuilder()
            .setTitle('📢 Notificação do Staff')
            .setDescription(`${user}, por favor, aguarde atendimento. Um membro da equipe irá te ajudar em breve.\n\nSe você tiver mais informações para adicionar, por favor, compartilhe agora.`)
            .setColor(0x00FF00)
            .setTimestamp();

        await interaction.channel.send({ 
            content: `${user}`,
            embeds: [notifyEmbed] 
        });
        await interaction.reply({ content: '✅ Usuário notificado com sucesso!', flags: 64 });
    } catch (error) {
        await interaction.reply({ 
            content: '❌ Erro ao notificar o usuário. O usuário pode ter saído do servidor.', 
            flags: 64 
        });
    }
}

async function addMember(interaction, ticketData) {
    // Criar modal para adicionar membro
    const modal = new ModalBuilder()
        .setCustomId('add-member-modal')
        .setTitle('Adicionar Membro ao Ticket');

    const userIdInput = new TextInputBuilder()
        .setCustomId('userId')
        .setLabel('ID do Usuário para Adicionar')
        .setPlaceholder('Digite o ID do usuário...')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

    const actionRow = new ActionRowBuilder().addComponents(userIdInput);
    modal.addComponents(actionRow);

    await interaction.showModal(modal);
}

async function handleAddMemberModal(interaction) {
    const userId = interaction.fields.getTextInputValue('userId');
    const ticketData = ticketDB.get(interaction.channel.id);
    
    if (!ticketData) return;

    try {
        const member = await interaction.guild.members.fetch(userId.trim());
        
        await interaction.channel.permissionOverwrites.edit(member, {
            ViewChannel: true,
            SendMessages: true,
            ReadMessageHistory: true,
            AttachFiles: true,
            EmbedLinks: true
        });

        const successEmbed = new EmbedBuilder()
            .setTitle('✅ Membro Adicionado')
            .setDescription(`${member} foi adicionado ao ticket com sucesso!`)
            .setColor(0x00FF00)
            .setTimestamp();

        await interaction.reply({ 
            embeds: [successEmbed]
        });

        // Notificar no ticket sobre o novo membro
        const notifyEmbed = new EmbedBuilder()
            .setTitle('👤 Novo Membro no Ticket')
            .setDescription(`${member} foi adicionado ao ticket por ${interaction.user}`)
            .setColor(0x0099FF)
            .setTimestamp();

        await interaction.channel.send({ embeds: [notifyEmbed] });

    } catch (error) {
        console.error('Erro ao adicionar membro:', error);
        const errorEmbed = new EmbedBuilder()
            .setTitle('❌ Erro ao Adicionar Membro')
            .setDescription('Não foi possível encontrar o usuário. Verifique se o ID está correto e se o usuário está no servidor.')
            .setColor(0xFF0000)
            .setTimestamp();

        await interaction.reply({ 
            embeds: [errorEmbed],
            flags: 64 
        });
    }
}

async function claimTicket(interaction, ticketData) {
    if (ticketData.claimedBy) {
        try {
            const claimedBy = await interaction.guild.members.fetch(ticketData.claimedBy);
            return interaction.reply({ 
                content: `❌ Este ticket já foi assumido por ${claimedBy}`, 
                flags: 64 
            });
        } catch (error) {
            // Se não conseguir encontrar o membro, limpa o claimedBy
            ticketData.claimedBy = null;
        }
    }

    ticketData.claimedBy = interaction.user.id;
    ticketDB.set(interaction.channel.id, ticketData);

    const claimEmbed = new EmbedBuilder()
        .setTitle('🎯 Ticket Assumido')
        .setDescription(`${interaction.user} assumiu este ticket e irá te ajudar.`)
        .setColor(0x00FF00)
        .addFields(
            { name: '👤 Staff Responsável', value: `${interaction.user.tag}`, inline: true },
            { name: '⏰ Horário', value: new Date().toLocaleString('pt-BR'), inline: true }
        )
        .setTimestamp();

    await interaction.channel.send({ embeds: [claimEmbed] });
    await interaction.reply({ content: '✅ Ticket assumido com sucesso!', flags: 64 });
}

async function transcriptTicket(interaction, ticketData) {
    try {
        const transcript = await generateTranscript(interaction.channel, ticketData);
        
        await interaction.reply({ 
            content: '📄 Transcript gerado (visualização):\n```' + transcript.substring(0, 1500) + '...```',
            flags: 64 
        });

    } catch (error) {
        console.error('Erro ao gerar transcript:', error);
        await interaction.reply({ 
            content: '❌ Erro ao gerar transcript.', 
            flags: 64 
        });
    }
}

async function closeTicket(interaction, ticketData) {
    if (ticketData.closed) {
        return interaction.reply({ 
            content: '❌ Este ticket já está fechado.', 
            flags: 64 
        });
    }

    // Gerar transcript antes de fechar
    try {
        const transcript = await generateTranscript(interaction.channel, ticketData);
        
        // Enviar transcript para o canal específico
        const transcriptChannel = interaction.guild.channels.cache.get(ticketData.transcriptChannelId);
        
        if (transcriptChannel) {
            const transcriptEmbed = new EmbedBuilder()
                .setTitle(`📄 Transcript - Ticket ${ticketData.type.toUpperCase()}`)
                .setDescription(`Transcript do ticket fechado`)
                .addFields(
                    { name: '👤 Usuário', value: `<@${ticketData.userId}> (${ticketData.userId})`, inline: true },
                    { name: '🎫 Tipo', value: ticketData.type, inline: true },
                    { name: '👤 Fechado por', value: interaction.user.tag, inline: true },
                    { name: '📅 Data de Abertura', value: ticketData.createdAt.toLocaleString('pt-BR'), inline: true },
                    { name: '📅 Data de Fechamento', value: new Date().toLocaleString('pt-BR'), inline: true },
                    { name: '⏰ Duração', value: calculateDuration(ticketData.createdAt), inline: true }
                )
                .setColor(0x0099FF)
                .setTimestamp();

            await transcriptChannel.send({
                embeds: [transcriptEmbed],
                files: [{
                    attachment: Buffer.from(transcript),
                    name: `transcript-${ticketData.type}-${ticketData.userId}-${Date.now()}.txt`
                }]
            });
            console.log('✅ Transcript enviado para o canal de logs');
        } else {
            console.log('❌ Canal de transcript não encontrado');
        }

        // Enviar transcript para o usuário via DM
        try {
            const user = await interaction.client.users.fetch(ticketData.userId);
            await user.send({
                content: `📄 **Transcript do seu ticket**\n\nAqui está o histórico completo do seu ticket **${ticketData.type}** que foi fechado.\n\n*Se você tiver alguma dúvida, entre em contato com a staff.*`,
                files: [{
                    attachment: Buffer.from(transcript),
                    name: `transcript-${ticketData.type}-${Date.now()}.txt`
                }]
            });
            console.log('✅ Transcript enviado para o usuário');
        } catch (userError) {
            console.log('❌ Não foi possível enviar transcript para o usuário (DM fechada)');
        }

    } catch (error) {
        console.error('❌ Erro ao gerar transcript:', error);
    }

    const closeEmbed = new EmbedBuilder()
        .setTitle('🔒 Ticket Fechado')
        .setDescription(`Este ticket foi fechado por ${interaction.user.tag}`)
        .addFields(
            { name: '👤 Fechado por', value: `${interaction.user.tag}`, inline: true },
            { name: '🎫 Tipo', value: ticketData.type, inline: true },
            { name: '⏰ Duração', value: calculateDuration(ticketData.createdAt), inline: true },
            { name: '📅 Data de Abertura', value: ticketData.createdAt.toLocaleString('pt-BR'), inline: false }
        )
        .setColor(0xFF0000)
        .setTimestamp();

    // Desativar botões
    const disabledButtons = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('notify-user')
            .setLabel('📢 Notificar')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(true),
        new ButtonBuilder()
            .setCustomId('add-member')
            .setLabel('➕ Adicionar Membro')
            .setStyle(ButtonStyle.Success)
            .setDisabled(true),
        new ButtonBuilder()
            .setCustomId('claim-ticket')
            .setLabel('👤 Assumir Ticket')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true),
        new ButtonBuilder()
            .setCustomId('transcript-ticket')
            .setLabel('📄 Transcript')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(true),
        new ButtonBuilder()
            .setCustomId('close-ticket')
            .setLabel('🔒 Fechado')
            .setStyle(ButtonStyle.Danger)
            .setDisabled(true)
    );

    // Atualizar mensagem original com botões desativados
    const messages = await interaction.channel.messages.fetch({ limit: 10 });
    const originalMessage = messages.find(msg => msg.components.length > 0);
    
    if (originalMessage) {
        try {
            await originalMessage.edit({ components: [disabledButtons] });
        } catch (error) {
            console.error('Erro ao desativar botões:', error);
        }
    }

    await interaction.channel.send({ embeds: [closeEmbed] });
    
    // Marcar como fechado no banco de dados
    ticketData.closed = true;
    ticketData.closedAt = new Date();
    ticketData.closedBy = interaction.user.id;
    ticketDB.set(interaction.channel.id, ticketData);

    await interaction.reply({ content: '✅ Ticket fechado com sucesso! O canal será deletado em 10 segundos...', flags: 64 });

    // Fechar canal após 10 segundos
    setTimeout(async () => {
        try {
            await interaction.channel.delete('Ticket fechado pelo sistema');
            ticketDB.delete(interaction.channel.id);
        } catch (error) {
            console.error('Erro ao deletar canal:', error);
        }
    }, 10000);
}

async function generateTranscript(channel, ticketData) {
    let transcript = `=== TRANSCRIPT DO TICKET ===\n\n`;
    transcript += `Tipo: ${ticketData.type}\n`;
    transcript += `Usuário: ${ticketData.userId}\n`;
    transcript += `Aberto em: ${ticketData.createdAt.toLocaleString('pt-BR')}\n`;
    transcript += `Canal: ${channel.name}\n`;
    transcript += `=================================\n\n`;

    try {
        let messages = await channel.messages.fetch({ limit: 100 });
        messages = messages.reverse();

        messages.forEach(message => {
            const timestamp = new Date(message.createdTimestamp).toLocaleString('pt-BR');
            const author = message.author.tag;
            const content = message.content || '(Sem conteúdo de texto)';
            
            transcript += `[${timestamp}] ${author}: ${content}\n`;
            
            if (message.attachments.size > 0) {
                transcript += `[ANEXOS]: ${message.attachments.map(att => att.url).join(', ')}\n`;
            }
            
            if (message.embeds.length > 0) {
                transcript += `[EMBEDS]: ${message.embeds.length} embed(s)\n`;
            }
            
            transcript += '\n';
        });

        transcript += `\n=================================\n`;
        transcript += `Ticket fechado em: ${new Date().toLocaleString('pt-BR')}\n`;
        transcript += `Total de mensagens: ${messages.size}\n`;

    } catch (error) {
        transcript += `\nERRO AO GERAR TRANSCRIPT: ${error.message}\n`;
    }

    return transcript;
}

function calculateDuration(startDate) {
    const diff = new Date() - startDate;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
        return `${hours}h ${minutes}m`;
    } else {
        return `${minutes}m`;
    }
}

// Exportar o suggestionsDB para ser usado no comando de sugestão
module.exports.suggestionsDB = suggestionsDB;
