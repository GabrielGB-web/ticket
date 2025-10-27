const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');

module.exports = {
    name: 'ready',
    once: true,
    async execute(client) {
        console.log(`✅ Bot conectado como ${client.user.tag}`);
        client.user.setActivity('Sistema de Tickets', { type: 'WATCHING' });

        // Registrar comandos slash
        try {
            const commands = [];
            const commandsPath = path.join(__dirname, '../commands');
            const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

            for (const file of commandFiles) {
                const filePath = path.join(commandsPath, file);
                const command = require(filePath);
                commands.push(command.data.toJSON());
            }

            const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

            console.log('🔄 Registrando comandos slash...');

            await rest.put(
                Routes.applicationCommands(client.user.id),
                { body: commands }
            );

            console.log('✅ Comandos slash registrados com sucesso!');
        } catch (error) {
            console.error('❌ Erro ao registrar comandos:', error);
        }
    }
};
