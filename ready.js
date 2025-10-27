const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');

module.exports = {
    name: 'ready',
    once: true,
    async execute(client) {
        console.log(`✅ Bot conectado como ${client.user.tag}`);
        
        // Definir status do bot
        client.user.setActivity('Sistema de Tickets', { type: 'WATCHING' });

        // Registrar comandos slash
        try {
            const commands = [];
            const commandsPath = path.join(__dirname, '../commands');
            
            // Carregar todos os comandos
            const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
            
            for (const file of commandFiles) {
                const filePath = path.join(commandsPath, file);
                try {
                    const command = require(filePath);
                    
                    if (command.data && command.data.name) {
                        commands.push(command.data.toJSON());
                        console.log(`📋 Comando ${command.data.name} adicionado para registro`);
                    }
                } catch (error) {
                    console.error(`❌ Erro ao carregar comando ${file}:`, error);
                }
            }

            if (commands.length === 0) {
                console.log('❌ Nenhum comando encontrado para registrar');
                return;
            }

            console.log(`🔄 Registrando ${commands.length} comandos slash...`);

            const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

            const data = await rest.put(
                Routes.applicationCommands(client.user.id),
                { body: commands }
            );

            console.log(`✅ ${data.length} comandos slash registrados com sucesso!`);
            console.log('📋 Comandos registrados:', data.map(cmd => cmd.name).join(', '));
            
        } catch (error) {
            console.error('❌ Erro ao registrar comandos:', error);
            
            // Log mais detalhado do erro
            if (error.code === 50001) {
                console.error('❌ Missing Access - Verifique se o bot tem permissão de "Applications Commands"');
            } else if (error.code === 50013) {
                console.error('❌ Missing Permissions - Verifique as permissões do bot');
            } else if (error.code === 40060) {
                console.error('❌ Application not verified - Bot precisa ser verificado para mais de 100 servidores');
            }
        }
    }
};
