require('dotenv').config();

const { Sequelize, Model, DataTypes } = require('sequelize');
const { Client } = require('discord.js');

const sequelize = new Sequelize('sqlite:./database.sqlite');

class User extends Model {}
User.init(
  {
    userId: DataTypes.STRING,
    guildId: DataTypes.STRING,
    username: DataTypes.STRING,
    balance: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
  },
  { sequelize, modelName: 'user' }
);

const prefix = process.env.DISCORD_BOT_PREFIX || '!';
const client = new Client();

client.on('ready', () => {
  client.user.setActivity(`${prefix}help`, { type: 'LISTENING' }).then(() => {
    console.log(`Logged in as ${client.user.tag}`);
  });

  setInterval(() => {
    client.guilds.cache.forEach((guild) => {
      guild.members.cache
        .filter((m) => !m.user.bot && m.user.presence.status === 'online')
        .forEach(async (member) => {
          let user = await User.findOne({
            where: { userId: member.user.id },
          });

          if (!user) {
            user = new User({
              userId: member.user.id,
              guildId: guild.id,
              username: member.user.username,
            });
          }

          user.balance = user.balance + 5;
          await user.save();
        });
    });
  }, 60000);
});

client.on('message', async (msg) => {
  if (!msg.content.startsWith(prefix) || msg.author.bot) return;

  const args = msg.content.slice(prefix.length).split(' ');
  const command = args.shift().toLowerCase();

  if (command === 'top') {
    try {
      const users = await User.findAll({
        where: { guildId: msg.guild.id },
        order: [['balance', 'DESC']],
        limit: 10,
      });
      return msg.channel.send({
        embed: {
          color: 0x0099ff,
          title: 'Top 10',
          description: 'These are the top 10 gamblers!',
          fields: users.map((user) => {
            return {
              name: user.username,
              value: `${user.balance} credits`,
            };
          }),
          timestamp: new Date(),
          footer: {
            text: 'Developed by Fedjz',
          },
        },
      });
    } catch (error) {
      console.log('Error while fetching top users..');
    }
  }

  if (command === 'help') {
    return msg.channel.send({
      embed: {
        color: 0x0099ff,
        title: 'GamblingBot Help',
        description: 'List of available commands',
        fields: [
          {
            name: '!balance',
            value: 'Check your current balance',
          },
          {
            name: '!gamble <amount>',
            value: 'Gamble an amount of your credits',
          },
          {
            name: '!top',
            value: 'Check the top 10 gamblers of the server',
          },
          {
            name: '!help',
            value: 'See available commands',
          },
        ],
        timestamp: new Date(),
        footer: {
          text: 'Developed by Fedjz',
        },
      },
    });
  }

  if (command === 'balance') {
    try {
      const user = await User.findOne({ where: { userId: msg.author.id } });

      if (!user) {
        return msg.channel.send(
          'You are not registered, check if your are **ONLINE**'
        );
      }

      return msg.channel.send(`You have ${user.balance} credits`);
    } catch (error) {
      console.log('Error at fetching balance..');
    }
  }

  if (command === 'gamble') {
    try {
      const user = await User.findOne({ where: { userId: msg.author.id } });

      if (!user) {
        return msg.channel.send(
          'You are not registered, check if your status is **ONLINE**'
        );
      }

      const amount = args[0];

      if (!amount || isNaN(amount)) {
        return msg.channel.send('Please enter a valid amount of credits..');
      }

      if (amount > user.balance) {
        return msg.channel.send(`You don't have ${amount} credits to gamble`);
      }

      const isWin = Math.random() >= 0.5;
      user.balance = isWin ? user.balance + +amount : user.balance - amount;
      await user.save();

      return msg.channel.send(
        `You have ${isWin ? 'won' : 'lost'} ${amount} credits!`
      );
    } catch (error) {
      console.log('Error at gambling..');
    }
  }
});

sequelize.sync({ logging: false }).then(() => {
  console.log('Connected to DB');
  client.login(process.env.DISCORD_BOT_TOKEN);
});
