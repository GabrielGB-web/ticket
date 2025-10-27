const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('debug')
        .setDescription('Verificar status do bot e comandos'),
    
    async execute(interaction) {
        const commands = interaction.client.commands;
        const commandList = Array.from(commands.keys()).join(', ') || 'Nenhum comando carregado';
        
        const embed = new EmbedBuilder()
            .setTitle('🔧 Debug - Status do Bot')
            .setColor(0x00FF00)
            .addFields(
                { name: '📋 Comandos Carregados', value: commandList, inline: false },
                { name: '🟢 Status', value: 'Online', inline: true },
                { name: '⏰ Uptime', value: `${Math.floor(interaction.client.uptime / 1000 / 60)} minutos`, inline: true },
                { name: '👥 Servidores', value: `${interaction.client.guilds.cache.size}`, inline: true }
            )
            .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
    }
};
