require('dotenv').config();
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const fs = require('fs');
const path = require('path');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

client.commands = new Collection();

// Configurar paths
const commandsPath = path.join(__dirname, 'commands');
const eventsPath = path.join(__dirname, 'events');

// Criar pastas se não existirem
if (!fs.existsSync(commandsPath)) {
    fs.mkdirSync(commandsPath, { recursive: true });
    console.log('📁 Pasta commands criada');
}

if (!fs.existsSync(eventsPath)) {
    fs.mkdirSync(eventsPath, { recursive: true });
    console.log('📁 Pasta events criada');
}

// Carregar comandos
function loadCommands() {
    try {
        const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
        console.log(`📝 Carregando ${commandFiles.length} comandos...`);

        for (const file of commandFiles) {
            const filePath = path.join(commandsPath, file);
            try {
                delete require.cache[require.resolve(filePath)];
                const command = require(filePath);
                
                if (!command.data || !command.execute) {
                    console.log(`⚠️  Comando ${file} está mal formatado`);
                    continue;
                }
                
                client.commands.set(command.data.name, command);
                console.log(`✅ Comando ${command.data.name} carregado`);
            } catch (error) {
                console.error(`❌ Erro ao carregar comando ${file}:`, error);
            }
        }
    } catch (error) {
        console.error('❌ Erro ao carregar comandos:', error);
    }
}

// Carregar eventos
function loadEvents() {
    try {
        const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));
        console.log(`📝 Carregando ${eventFiles.length} eventos...`);

        for (const file of eventFiles) {
            const filePath = path.join(eventsPath, file);
            try {
                delete require.cache[require.resolve(filePath)];
                const event = require(filePath);
                
                if (event.once) {
                    client.once(event.name, (...args) => event.execute(...args, client));
                } else {
                    client.on(event.name, (...args) => event.execute(...args, client));
                }
                console.log(`✅ Evento ${event.name} carregado`);
            } catch (error) {
                console.error(`❌ Erro ao carregar evento ${file}:`, error);
            }
        }
    } catch (error) {
        console.error('❌ Erro ao carregar eventos:', error);
    }
}

// Inicializar
loadCommands();
loadEvents();

// Tratamento de erros
process.on('unhandledRejection', error => {
    console.error('Unhandled promise rejection:', error);
});

process.on('uncaughtException', error => {
    console.error('Uncaught exception:', error);
});

client.login(process.env.DISCORD_TOKEN);
