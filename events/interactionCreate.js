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
                    ephemeral: true 
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
                    ephemeral: true 
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

        // Botão para sugerir
        if (interaction.isButton() && interaction.customId === 'suggest-button') {
            await handleSuggestionModal(interaction);
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
        .setTitle('🎫 Sistema de Atendimento')
        .setDescription('Escolha abaixo o tipo de atendimento que você precisa:')
        .setColor(0x0099FF)
        .addFields(
            { name: '🎫 Tickets', value: 'Atendimento personalizado com a equipe', inline: true },
            { name: '💡 Sugestões', value: 'Envie e vote em sugestões', inline: true }
        )
        .setFooter({ text: 'Selecione uma opção no menu abaixo' });

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('ticket-select')
        .setPlaceholder('Selecione o tipo de atendimento')
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
            },
            {
                label: 'Sugestão',
                description: 'Enviar uma sugestão para o servidor',
                value: 'sugestao',
                emoji: '💡'
            }
        ]);

    const row = new ActionRowBuilder().addComponents(selectMenu);

    await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
}

async function handleTicketCreation(interaction) {
    const selectedOption = interaction.values[0];
    const user = interaction.user;
    const guild = interaction.guild;

    // Se for sugestão, redireciona para o sistema de sugestões
    if (selectedOption === 'sugestao') {
        await handleSuggestionButton(interaction);
        return;
    }

    // CONFIGURAÇÃO DOS CARGOS E CANAIS - ALTERE OS IDs AQUI!
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
                '1330959853644025858', // ← CEO
                '1330959853644025864'  // ← Diretor Geral
            ],
            color: 0xFFD700
        }
    };

    // IDs DOS CANAIS - ALTERE ESTES IDs!
    const TRANSCRIPT_CHANNEL_ID = '1330959870425567262'; // ← ID do canal de transcripts
    const SUGGESTIONS_CHANNEL_ID = '1330959861915058317'; // ← ID do canal de sugestões

    const config = ticketConfigs[selectedOption];

    // Verificar se já existe ticket aberto
    const existingTicket = Array.from(ticketDB.values()).find(
        ticket => ticket.userId === user.id && ticket.guildId === guild.id && !ticket.closed
    );

    if (existingTicket) {
        return interaction.reply({ 
            content: '❌ Você já possui um ticket aberto! Por favor, aguarde o atendimento no ticket existente.', 
            ephemeral: true 
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
            ephemeral: true 
        });

    } catch (error) {
        console.error('Erro ao criar ticket:', error);
        await interaction.reply({ 
            content: '❌ Erro ao criar o ticket. Por favor, tente novamente ou contate um administrador.', 
            ephemeral: true 
        });
    }
}

// SISTEMA DE SUGESTÕES
async function handleSuggestionButton(interaction) {
    const embed = new EmbedBuilder()
        .setTitle('💡 Sistema de Sugestões')
        .setDescription('Clique no botão abaixo para enviar uma sugestão para o servidor!')
        .addFields(
            { name: '📝 Como funciona?', value: '• Sua sugestão será enviada para o canal de sugestões\n• A comunidade poderá votar 👍/👎\n• A staff irá analisar as mais votadas', inline: false },
            { name: '💡 Dicas', value: '• Seja claro e objetivo\n• Explique os benefícios da sugestão\n• Verifique se já não foi sugerido antes', inline: false }
        )
        .setColor(0x9B59B6)
        .setFooter({ text: 'Sua sugestão ajuda a melhorar nosso servidor!' });

    const button = new ButtonBuilder()
        .setCustomId('suggest-button')
        .setLabel('Enviar Sugestão')
        .setStyle(ButtonStyle.Success)
        .setEmoji('💡');

    const row = new ActionRowBuilder().addComponents(button);

    await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
}

async function handleSuggestionModal(interaction) {
    const modal = new ModalBuilder()
        .setCustomId('suggestion-modal')
        .setTitle('Enviar Sugestão');

    const suggestionInput = new TextInputBuilder()
        .setCustomId('suggestion-content')
        .setLabel('Qual é sua sugestão?')
        .setPlaceholder('Descreva sua sugestão de forma clara e detalhada...')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setMaxLength(2000);

    const actionRow = new ActionRowBuilder().addComponents(suggestionInput);
    modal.addComponents(actionRow);

    await interaction.showModal(modal);
}

async function handleSuggestionSubmit(interaction) {
    const suggestionContent = interaction.fields.getTextInputValue('suggestion-content');
    const user = interaction.user;
    const guild = interaction.guild;

    // ID do canal de sugestões - ALTERE ESTE ID!
    const SUGGESTIONS_CHANNEL_ID = '1330959861915058317';

    const suggestionsChannel = guild.channels.cache.get(SUGGESTIONS_CHANNEL_ID);
    
    if (!suggestionsChannel) {
        return await interaction.reply({ 
            content: '❌ Canal de sugestões não encontrado. Contate um administrador.', 
            ephemeral: true 
        });
    }

    try {
        // Criar embed da sugestão
        const suggestionEmbed = new EmbedBuilder()
            .setTitle('💡 Nova Sugestão')
            .setDescription(suggestionContent)
            .addFields(
                { name: '👤 Sugerido por', value: `${user.tag}`, inline: true },
                { name: '📅 Data', value: new Date().toLocaleString('pt-BR'), inline: true },
                { name: '📊 Votos', value: '👍 0 | 👎 0', inline: true }
            )
            .setColor(0x9B59B6)
            .setFooter({ text: `ID: ${Date.now()}` })
            .setTimestamp();

        // Botões de votação
        const voteButtons = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('suggestion-upvote')
                .setLabel('👍')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('suggestion-downvote')
                .setLabel('👎')
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId('suggestion-approve')
                .setLabel('✅ Aprovar')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('suggestion-deny')
                .setLabel('❌ Recusar')
                .setStyle(ButtonStyle.Secondary)
        );

        // Enviar sugestão para o canal
        const suggestionMessage = await suggestionsChannel.send({ 
            embeds: [suggestionEmbed], 
            components: [voteButtons] 
        });

        // Salvar sugestão no banco de dados
        const suggestionData = {
            messageId: suggestionMessage.id,
            channelId: suggestionsChannel.id,
            userId: user.id,
            content: suggestionContent,
            upvotes: [],
            downvotes: [],
            status: 'pending', // pending, approved, denied
            createdAt: new Date()
        };
        suggestionsDB.set(suggestionMessage.id, suggestionData);

        await interaction.reply({ 
            content: `✅ Sugestão enviada com sucesso! Confira em ${suggestionsChannel}`, 
            ephemeral: true 
        });

    } catch (error) {
        console.error('Erro ao enviar sugestão:', error);
        await interaction.reply({ 
            content: '❌ Erro ao enviar sugestão. Tente novamente.', 
            ephemeral: true 
        });
    }
}

async function handleSuggestionVote(interaction) {
    const messageId = interaction.message.id;
    const userId = interaction.user.id;
    const suggestionData = suggestionsDB.get(messageId);

    if (!suggestionData) {
        return await interaction.reply({ 
            content: '❌ Sugestão não encontrada.', 
            ephemeral: true 
        });
    }

    const isStaff = interaction.member.permissions.has(PermissionsBitField.Flags.ManageMessages);

    // Verificar se é ação de staff (aprovar/recusar)
    if (interaction.customId === 'suggestion-approve' || interaction.customId === 'suggestion-deny') {
        if (!isStaff) {
            return await interaction.reply({ 
                content: '❌ Apenas staff pode aprovar ou recusar sugestões.', 
                ephemeral: true 
            });
        }

        if (interaction.customId === 'suggestion-approve') {
            suggestionData.status = 'approved';
            suggestionData.reviewedBy = userId;
            suggestionData.reviewedAt = new Date();
            
            // Atualizar embed
            const approvedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
                .setColor(0x00FF00)
                .addFields({ name: '✅ Status', value: 'Aprovado', inline: true });

            await interaction.message.edit({ 
                embeds: [approvedEmbed],
                components: [] // Remove botões após aprovação
            });

            await interaction.reply({ 
                content: '✅ Sugestão aprovada com sucesso!', 
                ephemeral: true 
            });

        } else if (interaction.customId === 'suggestion-deny') {
            suggestionData.status = 'denied';
            suggestionData.reviewedBy = userId;
            suggestionData.reviewedAt = new Date();
            
            // Atualizar embed
            const deniedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
                .setColor(0xFF0000)
                .addFields({ name: '❌ Status', value: 'Recusado', inline: true });

            await interaction.message.edit({ 
                embeds: [deniedEmbed],
                components: [] // Remove botões após recusa
            });

            await interaction.reply({ 
                content: '❌ Sugestão recusada.', 
                ephemeral: true 
            });
        }

        suggestionsDB.set(messageId, suggestionData);
        return;
    }

    // Sistema de votação para membros comuns
    if (suggestionData.status !== 'pending') {
        return await interaction.reply({ 
            content: '❌ Esta sugestão já foi revisada pela staff.', 
            ephemeral: true 
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
    const updatedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
        .spliceFields(2, 1, { 
            name: '📊 Votos', 
            value: `👍 ${suggestionData.upvotes.length} | 👎 ${suggestionData.downvotes.length}`, 
            inline: true 
        });

    await interaction.message.edit({ embeds: [updatedEmbed] });
    suggestionsDB.set(messageId, suggestionData);

    await interaction.reply({ 
        content: `✅ Seu voto ${isUpvote ? '👍' : '👎'} foi registrado!`, 
        ephemeral: true 
    });
}

// Adicione este handler para o modal de sugestões
if (interaction.isModalSubmit() && interaction.customId === 'suggestion-modal') {
    await handleSuggestionSubmit(interaction);
    return;
}

// ... (o resto das funções permanecem iguais: handleTicketButtons, notifyUser, addMember, claimTicket, transcriptTicket, closeTicket, generateTranscript, calculateDuration)

async function handleTicketButtons(interaction) {
    const ticketData = ticketDB.get(interaction.channel.id);
    
    if (!ticketData) {
        return interaction.reply({ 
            content: '❌ Este canal não é um ticket válido ou os dados foram perdidos.', 
            ephemeral: true 
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
            ephemeral: true 
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
        await interaction.reply({ content: '✅ Usuário notificado com sucesso!', ephemeral: true });
    } catch (error) {
        await interaction.reply({ 
            content: '❌ Erro ao notificar o usuário. O usuário pode ter saído do servidor.', 
            ephemeral: true 
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
            ephemeral: true 
        });
    }
}

async function claimTicket(interaction, ticketData) {
    if (ticketData.claimedBy) {
        try {
            const claimedBy = await interaction.guild.members.fetch(ticketData.claimedBy);
            return interaction.reply({ 
                content: `❌ Este ticket já foi assumido por ${claimedBy}`, 
                ephemeral: true 
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
    await interaction.reply({ content: '✅ Ticket assumido com sucesso!', ephemeral: true });
}

async function transcriptTicket(interaction, ticketData) {
    try {
        const transcript = await generateTranscript(interaction.channel, ticketData);
        
        await interaction.reply({ 
            content: '📄 Transcript gerado (visualização):\n```' + transcript.substring(0, 1500) + '...```',
            ephemeral: true 
        });

    } catch (error) {
        console.error('Erro ao gerar transcript:', error);
        await interaction.reply({ 
            content: '❌ Erro ao gerar transcript.', 
            ephemeral: true 
        });
    }
}

async function closeTicket(interaction, ticketData) {
    if (ticketData.closed) {
        return interaction.reply({ 
            content: '❌ Este ticket já está fechado.', 
            ephemeral: true 
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

    await interaction.reply({ content: '✅ Ticket fechado com sucesso! O canal será deletado em 10 segundos...', ephemeral: true });

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
        messages = messages.reverse(); // Ordem cronológica

        messages.forEach(message => {
            const timestamp = new Date(message.createdTimestamp).toLocaleString('pt-BR');
            const author = message.author.tag;
            const content = message.content || '(Sem conteúdo de texto)';
            
            transcript += `[${timestamp}] ${author}: ${content}\n`;
            
            // Adicionar anexos se houver
            if (message.attachments.size > 0) {
                transcript += `[ANEXOS]: ${message.attachments.map(att => att.url).join(', ')}\n`;
            }
            
            // Adicionar embeds se houver
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
