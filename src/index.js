require('dotenv').config();

const { Sequelize, Model, DataTypes } = require('sequelize');
const { Client } = require('discord.js');

const sequelize = new Sequelize('sqlite:./database.sqlite');

class User extends Model {}
User.init(
  {
    userId: DataTypes.STRING,
    username: DataTypes.STRING,
    balance: {
      type: DataTypes.INTEGER,
      defaultValue: 5,
    },
    lastMessageTimestamp: DataTypes.INTEGER,
  },
  { sequelize, modelName: 'user' }
);

const client = new Client();

client.on('ready', () => {
  console.log('discord bot running!');
});

client.on('message', async (msg) => {
  if (msg.author.bot) return;

  try {
    let user = await User.findOne({ where: { userId: msg.author.id } });

    if (!user) {
      user = new User({
        userId: msg.author.id,
        username: msg.author.username,
        lastMessageTimestamp: msg.createdTimestamp,
      });
    }

    if (!msg.content.startsWith('!')) {
      const time = Date.now() - user.lastMessageTimestamp;
      if (time > 60000) {
        user.balance = user.balance + 5;
        user.lastMessageTimestamp = msg.createdTimestamp;
      }
    }

    user.username = msg.author.username;
    await user.save();

    if (msg.content === '!balance') {
      return msg.channel.send(`you have ${user.balance} credits`);
    }

    if (msg.content.startsWith('!gamble')) {
      const args = msg.content
        .split(' ')
        .slice(1)
        .filter((x) => x);
      const amount = args[0];

      if (!amount || isNaN(amount)) {
        return msg.channel.send('please enter a valid amount..');
      }

      if (amount > user.balance) {
        return msg.channel.send(`you don't have ${amount} credits to bet`);
      }

      const result = Math.random() > 0.5;
      user.balance = result ? user.balance + +amount : user.balance - amount;
      await user.save();

      return msg.channel.send(
        `you have ${result ? 'won' : 'lost'} ${amount} credits`
      );
    }

    if (msg.content.startsWith('!top')) {
      const users = await User.findAll({
        limit: 10,
        order: [['balance', 'DESC']],
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
            text: 'Developed by federico',
          },
        },
      });
    }

    if (msg.content.startsWith('!help')) {
      return msg.channel.send({
        embed: {
          color: 0x0099ff,
          title: 'GamblingBot',
          description: 'List of available commands',
          fields: [
            {
              name: '!balance',
              value: 'Check your balance',
            },
            {
              name: '!gamble <amount>',
              value: 'Gamble an amount of credits',
            },
            {
              name: '!top',
              value: 'Check the top 10 gamblers ',
            },
            {
              name: '!help',
              value: 'See available commands',
            },
          ],
          timestamp: new Date(),
          footer: {
            text: 'Developed by federico',
          },
        },
      });
    }
  } catch (error) {
    console.log(error);
  }
});

sequelize.sync().then(() => {
  console.log('connected to db');
  client.login(process.env.DISCORD_BOT_TOKEN);
});
