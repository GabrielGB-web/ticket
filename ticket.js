const { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ticket')
        .setDescription('Abrir sistema de tickets')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    
    async execute(interaction) {
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

        await interaction.reply({ embeds: [embed], components: [row] });
    }
};
