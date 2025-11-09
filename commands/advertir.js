const { 
    SlashCommandBuilder, 
    EmbedBuilder, 
    PermissionFlagsBits 
} = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('advertir')
        .setDescription('Aplicar advertência a um membro')
        .addUserOption(option =>
            option.setName('membro')
                .setDescription('Membro a ser advertido')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('motivo')
                .setDescription('Motivo da advertência')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('prova')
                .setDescription('Link da prova (vídeo/print)')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
    
    async execute(interaction) {
        const member = interaction.options.getMember('membro');
        const motivo = interaction.options.getString('motivo');
        const prova = interaction.options.getString('prova') || 'Não fornecida';
        const staff = interaction.user;
        const guild = interaction.guild;

        // IDs CONFIGURADOS
        const ADV1_ROLE_ID = '1437127867061502063';
        const ADV2_ROLE_ID = '1437128056996364439';
        const ADV3_ROLE_ID = '1437128099606298676';
        const BANIDO_ROLE_ID = '1437128138336370728';
        const ADVERTENCIAS_CHANNEL_ID = '1330959870425567265';
        const BANIDOS_CHANNEL_ID = '1330959870425567266';
        const LOG_CHANNEL_ID = '1330959870425567264';

        if (!member) {
            return await interaction.reply({ 
                content: '❌ Membro não encontrado.', 
                flags: 64 
            });
        }

        if (member.user.bot) {
            return await interaction.reply({ 
                content: '❌ Não é possível advertir bots.', 
                flags: 64 
            });
        }

        if (member.id === staff.id) {
            return await interaction.reply({ 
                content: '❌ Você não pode se advertir.', 
                flags: 64 
            });
        }

        try {
            // Verificar advertências atuais
            const temAdv1 = member.roles.cache.has(ADV1_ROLE_ID);
            const temAdv2 = member.roles.cache.has(ADV2_ROLE_ID);
            const temAdv3 = member.roles.cache.has(ADV3_ROLE_ID);
            const estaBanido = member.roles.cache.has(BANIDO_ROLE_ID);

            if (estaBanido) {
                return await interaction.reply({ 
                    content: '❌ Este membro já está banido.', 
                    flags: 64 
                });
            }

            let novaAdvertencia = '';
            let acaoTomada = '';
            let isBanimento = false;
            let advertenciaNumero = 0;

            // Lógica das advertências
            if (!temAdv1 && !temAdv2 && !temAdv3) {
                // Primeira advertência
                await member.roles.add(ADV1_ROLE_ID);
                novaAdvertencia = 'Adv1';
                acaoTomada = 'Primeira advertência aplicada';
                advertenciaNumero = 1;
                
            } else if (temAdv1 && !temAdv2 && !temAdv3) {
                // Segunda advertência
                await member.roles.add(ADV2_ROLE_ID);
                novaAdvertencia = 'Adv2';
                acaoTomada = 'Segunda advertência aplicada';
                advertenciaNumero = 2;
                
            } else if (temAdv2 && !temAdv3) {
                // Terceira advertência - BANIMENTO
                isBanimento = true;
                await member.roles.add(BANIDO_ROLE_ID);
                // Remover outras tags de advertência
                await member.roles.remove([ADV1_ROLE_ID, ADV2_ROLE_ID, ADV3_ROLE_ID]);
                novaAdvertencia = 'BANIDO';
                acaoTomada = 'Terceira advertência - MEMBRO BANIDO';
                advertenciaNumero = 3;
                
                // Banir o membro
                try {
                    await member.ban({ 
                        reason: `3ª Advertência: ${motivo} | Aplicado por: ${staff.tag}`,
                        deleteMessageSeconds: 60 * 60 * 24 // Deletar mensagens de 1 dia
                    });
                } catch (banError) {
                    console.log('Não foi possível banir o membro, apenas a tag foi aplicada:', banError);
                }
            } else {
                return await interaction.reply({ 
                    content: '❌ Este membro já atingiu o limite máximo de advertências.', 
                    flags: 64 
                });
            }

            // Notificar o membro advertido (se não for banimento)
            let notificacaoEnviada = false;
            if (!isBanimento) {
                try {
                    const dmEmbed = new EmbedBuilder()
                        .setTitle('🚨 VOCÊ RECEBEU UMA ADVERTÊNCIA')
                        .setColor(0xFFA500)
                        .addFields(
                            { name: '📊 Advertência', value: `${advertenciaNumero}ª Advertência (${novaAdvertencia})`, inline: true },
                            { name: '🛡️ Aplicada por', value: `${staff.tag}`, inline: true },
                            { name: '📝 Motivo', value: motivo, inline: false },
                            { name: '🔗 Prova', value: prova, inline: false },
                            { name: '⏰ Data', value: new Date().toLocaleString('pt-BR'), inline: true },
                            { name: '⚠️ Aviso', value: `Você tem ${3 - advertenciaNumero} advertência(s) restante(s) antes do banimento.`, inline: false },
                            { name: '📞 Recursos', value: 'Caso discorde desta advertência, abra um ticket no canal de tickets para recorrer.', inline: false }
                        )
                        .setFooter({ text: 'Sistema de Advertências - PazCity' })
                        .setTimestamp();

                    await member.send({ embeds: [dmEmbed] });
                    notificacaoEnviada = true;
                } catch (dmError) {
                    console.log('Não foi possível enviar DM para o membro:', dmError);
                }
            }

            // Enviar para o canal de advertências
            const advertChannel = guild.channels.cache.get(ADVERTENCIAS_CHANNEL_ID);
            
            if (advertChannel) {
                const advertEmbed = new EmbedBuilder()
                    .setTitle(isBanimento ? '🔴 MEMBRO BANIDO' : '🚨 ADVERTÊNCIA APLICADA')
                    .setColor(isBanimento ? 0xFF0000 : 0xFFA500)
                    .addFields(
                        { name: '👤 Membro', value: `${member.user.tag} (${member.id})`, inline: true },
                        { name: '🚨 Advertência', value: novaAdvertencia, inline: true },
                        { name: '🛡️ Aplicado por', value: `${staff.tag}`, inline: true },
                        { name: '📝 Motivo', value: motivo, inline: false },
                        { name: '🔗 Prova', value: prova, inline: false },
                        { name: '⏰ Data', value: new Date().toLocaleString('pt-BR'), inline: true },
                        { name: '⚡ Ação', value: acaoTomada, inline: true },
                        { name: '📨 Notificação', value: notificacaoEnviada ? '✅ Enviada' : '❌ Não enviada (DM fechada)', inline: true }
                    )
                    .setFooter({ text: 'Sistema de Advertências Automáticas' })
                    .setTimestamp();

                const message = await advertChannel.send({ 
                    content: isBanimento ? '' : `${member}`, // Menciona o membro no canal
                    embeds: [advertEmbed] 
                });

                // Adicionar reações para interação
                if (!isBanimento) {
                    await message.react('🚨');
                    await message.react('⚠️');
                }
            }

            // Enviar para o canal de banidos se for banimento
            if (isBanimento) {
                const banidosChannel = guild.channels.cache.get(BANIDOS_CHANNEL_ID);
                if (banidosChannel) {
                    const banEmbed = new EmbedBuilder()
                        .setTitle('🔴 MEMBRO BANIDO')
                        .setColor(0xFF0000)
                        .addFields(
                            { name: '👤 Membro', value: `${member.user.tag} (${member.id})`, inline: true },
                            { name: '🛡️ Banido por', value: `${staff.tag}`, inline: true },
                            { name: '📝 Motivo', value: `3ª Advertência: ${motivo}`, inline: false },
                            { name: '🔗 Prova', value: prova, inline: false },
                            { name: '⏰ Data', value: new Date().toLocaleString('pt-BR'), inline: true },
                            { name: '🚨 Histórico', value: '3 advertências acumuladas', inline: false }
                        )
                        .setFooter({ text: 'Sistema de Banimentos Automáticos' })
                        .setTimestamp();

                    await banidosChannel.send({ embeds: [banEmbed] });
                }
            }

            // Enviar para o canal de LOG
            const logChannel = guild.channels.cache.get(LOG_CHANNEL_ID);
            if (logChannel) {
                const logEmbed = new EmbedBuilder()
                    .setTitle('📝 LOG - ADVERTÊNCIA APLICADA')
                    .setColor(0x3498DB)
                    .addFields(
                        { name: '👤 Membro', value: `${member.user.tag} (${member.id})`, inline: true },
                        { name: '🛡️ Staff', value: `${staff.tag} (${staff.id})`, inline: true },
                        { name: '🚨 Ação', value: isBanimento ? 'BANIMENTO' : `Advertência ${novaAdvertencia}`, inline: true },
                        { name: '📝 Motivo', value: motivo, inline: false },
                        { name: '🔗 Prova', value: prova, inline: false },
                        { name: '📨 Notificação', value: notificacaoEnviada ? '✅ Enviada' : '❌ Não enviada', inline: true },
                        { name: '⏰ Data', value: new Date().toLocaleString('pt-BR'), inline: true }
                    )
                    .setFooter({ text: 'Sistema de Logs - Advertências' })
                    .setTimestamp();

                await logChannel.send({ embeds: [logEmbed] });
            }

            let resposta = `✅ ${isBanimento ? 'Banimento' : 'Advertência'} **${novaAdvertencia}** aplicada com sucesso para ${member.user.tag}!`;
            if (!isBanimento) {
                resposta += `\n📨 Notificação: ${notificacaoEnviada ? '✅ Enviada' : '❌ DM fechada'}`;
                resposta += `\n⚠️ Restam ${3 - advertenciaNumero} advertência(s) antes do banimento.`;
            }

            await interaction.reply({ 
                content: resposta, 
                flags: 64 
            });

        } catch (error) {
            console.error('Erro ao aplicar advertência:', error);
            await interaction.reply({ 
                content: '❌ Erro ao aplicar advertência. Verifique as permissões do bot.', 
                flags: 64 
            });
        }
    }
};
