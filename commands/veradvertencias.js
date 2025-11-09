const { 
    SlashCommandBuilder, 
    EmbedBuilder 
} = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('veradvertencias')
        .setDescription('Ver advertências de um membro')
        .addUserOption(option =>
            option.setName('membro')
                .setDescription('Membro a ver as advertências')
                .setRequired(true)),
    
    async execute(interaction) {
        const member = interaction.options.getMember('membro');

        // IDs CONFIGURADOS
        const ADV1_ROLE_ID = '1437127867061502063';
        const ADV2_ROLE_ID = '1437128056996364439';
        const ADV3_ROLE_ID = '1437128099606298676';
        const BANIDO_ROLE_ID = '1437128138336370728';

        if (!member) {
            return await interaction.reply({ 
                content: '❌ Membro não encontrado.', 
                flags: 64 
            });
        }

        const temAdv1 = member.roles.cache.has(ADV1_ROLE_ID);
        const temAdv2 = member.roles.cache.has(ADV2_ROLE_ID);
        const temAdv3 = member.roles.cache.has(ADV3_ROLE_ID);
        const estaBanido = member.roles.cache.has(BANIDO_ROLE_ID);

        let status = '✅ Limpo';
        let advertencias = [];
        let cor = 0x00FF00; // Verde

        if (estaBanido) {
            status = '🔴 BANIDO';
            advertencias.push('Banido (3ª Advertência)');
            cor = 0xFF0000; // Vermelho
        } else if (temAdv3) {
            status = '🟡 3/3 Advertências';
            advertencias.push('Adv3');
            cor = 0xFFA500; // Laranja
        } else if (temAdv2) {
            status = '🟡 2/3 Advertências';
            advertencias.push('Adv2');
            cor = 0xFFA500; // Laranja
        } else if (temAdv1) {
            status = '🟡 1/3 Advertências';
            advertencias.push('Adv1');
            cor = 0xFFA500; // Laranja
        }

        const embed = new EmbedBuilder()
            .setTitle('📋 STATUS DE ADVERTÊNCIAS')
            .setColor(cor)
            .addFields(
                { name: '👤 Membro', value: `${member.user.tag} (${member.id})`, inline: true },
                { name: '📊 Status', value: status, inline: true },
                { name: '🚨 Advertências Ativas', value: advertencias.length > 0 ? advertencias.join(', ') : 'Nenhuma', inline: false },
                { name: '📅 Consultado em', value: new Date().toLocaleString('pt-BR'), inline: true }
            )
            .setFooter({ text: 'Sistema de Advertências Automáticas' })
            .setTimestamp();

        await interaction.reply({ 
            embeds: [embed], 
            flags: 64 
        });
    }
};
