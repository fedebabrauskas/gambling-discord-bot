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

const PREFIX = process.env.DISCORD_BOT_PREFIX || '!';
const client = new Client();

client.on('ready', () => {
  client.user.setActivity(`${PREFIX}help`, { type: 'LISTENING' }).then(() => {
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
  if (!msg.content.startsWith(PREFIX) || msg.author.bot) return;

  const args = msg.content.slice(PREFIX.length).split(' ');
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
            name: '!bet <amount>',
            value: 'Bet an amount of your credits',
          },
          {
            name: '!give <amount> <user>',
            value: 'Give an amount of credits to another user',
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

  if (command === 'bet') {
    try {
      const user = await User.findOne({ where: { userId: msg.author.id } });

      if (!user) {
        return msg.channel.send(
          'You are not registered, check if your status is **ONLINE**'
        );
      }

      const amount = args[0];

      if (!amount || isNaN(amount) || amount <= 0) {
        return msg.channel.send('Please enter a valid amount of credits..');
      }

      if (amount > user.balance) {
        return msg.channel.send(`You don't have ${amount} credits to bet`);
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

  if (command === 'give') {
    try {
      const user = await User.findOne({ where: { userId: msg.author.id } });

      if (!user) {
        return msg.channel.send(
          'You are not registered, check if your status is **ONLINE**'
        );
      }

      const amount = args[0];

      if (!amount || isNaN(amount) || amount <= 0) {
        return msg.channel.send('Please enter a valid amount of credits..');
      }

      if (amount > user.balance) {
        return msg.channel.send(`You don't have ${amount} credits to give`);
      }

      const targetUser = msg.mentions.users.first();

      if (!targetUser) {
        return msg.channel.send(
          `You must enter a valid user to give credits..`
        );
      }

      const recipientUser = await User.findOne({
        where: { userId: targetUser.id },
      });

      if (!recipientUser) {
        return msg.channel.send('The user you entered is not registered yet..');
      }

      user.balance = user.balance - amount;
      await user.save();

      recipientUser.balance = recipientUser.balance + +amount;
      await recipientUser.save();

      return msg.channel.send(
        `**${msg.author}** has given **${targetUser}** ${amount} credits! :money_mouth:`
      );
    } catch (error) {
      console.log('Error at giving credits..');
    }
  }
});

sequelize.sync({ logging: false }).then(() => {
  console.log('Connected to DB');
  client.login(process.env.DISCORD_BOT_TOKEN);
});
