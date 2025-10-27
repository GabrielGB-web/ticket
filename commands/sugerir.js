const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('sugerir')
        .setDescription('Enviar uma sugestão para o servidor')
        .addStringOption(option =>
            option.setName('sugestao')
                .setDescription('Sua sugestão')
                .setRequired(true)),
    
    async execute(interaction) {
        const sugestao = interaction.options.getString('sugestao');
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
                .setDescription(sugestao)
                .addFields(
                    { name: '👤 Sugerido por', value: `${user.tag}`, inline: true },
                    { name: '📅 Data', value: new Date().toLocaleString('pt-BR'), inline: true },
                    { name: '📊 Votos', value: '👍 0 | 👎 0', inline: true },
                    { name: '📝 Status', value: '⏳ Pendente', inline: true }
                )
                .setColor(0x9B59B6)
                .setFooter({ text: `ID: ${Date.now()}` })
                .setTimestamp();

            // Botões de votação
            const voteButtons = new ActionRowBuilder()
                .addComponents(
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
            const { suggestionsDB } = require('../events/interactionCreate');
            const suggestionData = {
                messageId: suggestionMessage.id,
                channelId: suggestionsChannel.id,
                userId: user.id,
                userTag: user.tag,
                content: sugestao,
                upvotes: [],
                downvotes: [],
                status: 'pending',
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
};
