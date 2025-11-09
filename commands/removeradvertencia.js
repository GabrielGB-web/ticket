const { 
    SlashCommandBuilder, 
    EmbedBuilder, 
    PermissionFlagsBits 
} = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('removeradvertencia')
        .setDescription('Remover advertência de um membro')
        .addUserOption(option =>
            option.setName('membro')
                .setDescription('Membro a ter a advertência removida')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('tipo')
                .setDescription('Tipo de advertência a remover')
                .setRequired(true)
                .addChoices(
                    { name: 'Adv1', value: 'adv1' },
                    { name: 'Adv2', value: 'adv2' },
                    { name: 'Todas', value: 'todas' }
                ))
        .addStringOption(option =>
            option.setName('motivo')
                .setDescription('Motivo da remoção')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
    
    async execute(interaction) {
        const member = interaction.options.getMember('membro');
        const tipo = interaction.options.getString('tipo');
        const motivo = interaction.options.getString('motivo');
        const staff = interaction.user;
        const guild = interaction.guild;

        // IDs CONFIGURADOS
        const ADV1_ROLE_ID = '1437127867061502063';
        const ADV2_ROLE_ID = '1437128056996364439';
        const ADV3_ROLE_ID = '1437128099606298676';
        const BANIDO_ROLE_ID = '1437128138336370728';
        const ADVERTENCIAS_CHANNEL_ID = '1330959870425567265';
        const LOG_CHANNEL_ID = '1330959870425567264';

        if (!member) {
            return await interaction.reply({ 
                content: '❌ Membro não encontrado.', 
                flags: 64 
            });
        }

        try {
            let acaoRealizada = '';
            let tagsRemovidas = [];

            if (tipo === 'todas') {
                // Remover todas as advertências
                const rolesToRemove = [ADV1_ROLE_ID, ADV2_ROLE_ID, ADV3_ROLE_ID, BANIDO_ROLE_ID];
                for (const roleId of rolesToRemove) {
                    if (member.roles.cache.has(roleId)) {
                        await member.roles.remove(roleId);
                        // Adicionar nome da tag removida
                        const roleName = guild.roles.cache.get(roleId)?.name || roleId;
                        tagsRemovidas.push(roleName);
                    }
                }
                acaoRealizada = 'Todas as advertências removidas';
                
            } else if (tipo === 'adv1') {
                if (member.roles.cache.has(ADV1_ROLE_ID)) {
                    await member.roles.remove(ADV1_ROLE_ID);
                    acaoRealizada = 'Advertência 1 removida';
                    tagsRemovidas.push('Adv1');
                } else {
                    return await interaction.reply({ 
                        content: '❌ Este membro não possui a advertência Adv1.', 
                        flags: 64 
                    });
                }
            } else if (tipo === 'adv2') {
                if (member.roles.cache.has(ADV2_ROLE_ID)) {
                    await member.roles.remove(ADV2_ROLE_ID);
                    acaoRealizada = 'Advertência 2 removida';
                    tagsRemovidas.push('Adv2');
                } else {
                    return await interaction.reply({ 
                        content: '❌ Este membro não possui a advertência Adv2.', 
                        flags: 64 
                    });
                }
            }

            // Notificar o membro sobre a remoção
            let notificacaoEnviada = false;
            try {
                const dmEmbed = new EmbedBuilder()
                    .setTitle('✅ ADVERTÊNCIA REMOVIDA')
                    .setColor(0x00FF00)
                    .addFields(
                        { name: '🗑️ Advertências Removidas', value: tagsRemovidas.join(', '), inline: true },
                        { name: '🛡️ Removido por', value: `${staff.tag}`, inline: true },
                        { name: '📝 Motivo', value: motivo, inline: false },
                        { name: '⏰ Data', value: new Date().toLocaleString('pt-BR'), inline: true },
                        { name: '🎉 Status', value: 'Sua advertência foi removida com sucesso!', inline: false }
                    )
                    .setFooter({ text: 'Sistema de Advertências - PazCity' })
                    .setTimestamp();

                await member.send({ embeds: [dmEmbed] });
                notificacaoEnviada = true;
            } catch (dmError) {
                console.log('Não foi possível enviar DM para o membro:', dmError);
            }

            // Enviar para o canal de advertências
            const advertChannel = guild.channels.cache.get(ADVERTENCIAS_CHANNEL_ID);
            
            if (advertChannel && tagsRemovidas.length > 0) {
                const removeEmbed = new EmbedBuilder()
                    .setTitle('✅ ADVERTÊNCIA REMOVIDA')
                    .setColor(0x00FF00)
                    .addFields(
                        { name: '👤 Membro', value: `${member.user.tag} (${member.id})`, inline: true },
                        { name: '🗑️ Advertências Removidas', value: tagsRemovidas.join(', '), inline: true },
                        { name: '🛡️ Removido por', value: `${staff.tag}`, inline: true },
                        { name: '📝 Motivo', value: motivo, inline: false },
                        { name: '⏰ Data', value: new Date().toLocaleString('pt-BR'), inline: true },
                        { name: '⚡ Ação', value: acaoRealizada, inline: true },
                        { name: '📨 Notificação', value: notificacaoEnviada ? '✅ Enviada' : '❌ Não enviada (DM fechada)', inline: true }
                    )
                    .setFooter({ text: 'Sistema de Advertências Automáticas' })
                    .setTimestamp();

                const message = await advertChannel.send({ 
                    content: `${member}`, // Menciona o membro no canal
                    embeds: [removeEmbed] 
                });

                // Adicionar reações
                await message.react('✅');
                await message.react('🎉');
            }

            // Enviar para o canal de LOG
            const logChannel = guild.channels.cache.get(LOG_CHANNEL_ID);
            if (logChannel && tagsRemovidas.length > 0) {
                const logEmbed = new EmbedBuilder()
                    .setTitle('📝 LOG - ADVERTÊNCIA REMOVIDA')
                    .setColor(0x2ECC71)
                    .addFields(
                        { name: '👤 Membro', value: `${member.user.tag} (${member.id})`, inline: true },
                        { name: '🛡️ Staff', value: `${staff.tag} (${staff.id})`, inline: true },
                        { name: '🗑️ Ação', value: `Remoção: ${tagsRemovidas.join(', ')}`, inline: true },
                        { name: '📝 Motivo', value: motivo, inline: false },
                        { name: '📨 Notificação', value: notificacaoEnviada ? '✅ Enviada' : '❌ Não enviada', inline: true },
                        { name: '⏰ Data', value: new Date().toLocaleString('pt-BR'), inline: true }
                    )
                    .setFooter({ text: 'Sistema de Logs - Advertências' })
                    .setTimestamp();

                await logChannel.send({ embeds: [logEmbed] });
            }

            let resposta = `✅ Advertência(s) removida(s) com sucesso de ${member.user.tag}!`;
            resposta += `\n📨 Notificação: ${notificacaoEnviada ? '✅ Enviada' : '❌ DM fechada'}`;

            await interaction.reply({ 
                content: resposta, 
                flags: 64 
            });

        } catch (error) {
            console.error('Erro ao remover advertência:', error);
            await interaction.reply({ 
                content: '❌ Erro ao remover advertência. Verifique as permissões do bot.', 
                flags: 64 
            });
        }
    }
};
