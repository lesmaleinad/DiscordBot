const Discord = require("discord.js");
const ytdl = require("ytdl-core-discord");
const client = new Discord.Client();

// Guilds
const gamenight = "617415978011066400";

// Channels
const raidGeneral = "337414411188961281";
const gamenightGeneral = "617415978011066410";
const botSoup = "698615585264762941";

// Users
const magnat = "490700636665413652";
const flyguy = "225467704948162561";
const dan = "319918516310376448";
const swensey = "118949183662194688";

let prank = true;

let cursedMember = dan;

client.once("ready", async () => {
  console.log("OceanCurse Online");
});

function getRandomMan() {
  const items = [
    "https://www.youtube.com/watch?v=tkzY_VwNIek",
    "https://www.youtube.com/watch?v=4RSUuu_FqHo",
    "https://www.youtube.com/watch?v=Aad3ufeWQDc",
    "https://www.youtube.com/watch?v=sX25DfAkmBo",
    "https://www.youtube.com/watch?v=WeRMPOufeSw",
    "https://youtu.be/bC_k4ClAEqc",
    "https://youtu.be/ZjZFn4ZKIzY",
    "https://youtu.be/xfm8xjyBbeg",
    "https://youtu.be/Fuha7g0hYA4",
    "https://youtu.be/qLTNjWdzqGo",
    "https://youtu.be/DU8Gq3-tccI",
    "https://youtu.be/NQLHwyY9S7w",
    "https://youtu.be/k2ECO76kI44",
    "https://youtu.be/RI5Z1Lo_oIk",
    "https://youtu.be/YCDLkW8uwz4",
    "https://youtu.be/W5jQm9esneU",
    "https://youtu.be/X0N9fQtzSHw",
    "https://youtu.be/BfSvnzWAm6Q",
    "https://youtu.be/CVi39Rl3GLI",
    "https://youtu.be/QFwq3CI1Jw0",
  ];

  return items[Math.floor(Math.random() * items.length)];
}

async function startOceanMan(channel, message = "Deploying Ocean Man...") {
  const connection = await channel.join();
  const bot = await client.channels.fetch(botSoup);
  bot.send(message);
  const stream = await ytdl(getRandomMan());
  connection.play(stream, { type: "opus" });
  stream.once("end", () => {
    channel.leave();
  });
  stream.once("close", () => {
    stream.removeAllListeners();
  });
}

function guildEmoji(guild, emojiName) {
  return guild.emojis.cache.find((emoji) => emoji.name === emojiName);
}

client.on("voiceStateUpdate", (oldState, newState) => {
  const channel = newState.channel;

  if (
    channel &&
    !oldState.channel &&
    channel.id === gamenightGeneral &&
    newState.member.id === cursedMember
  ) {
    startOceanMan(
      channel,
      `Deploying OceanCurse for ${newState.member.displayName}.`
    );
  }
});

client.on("message", async (message) => {
  const generalVoice = await client.channels.fetch(gamenightGeneral);
  const content = message.toString().toLowerCase();
  if (message.guild && message.guild.id === gamenight && !message.author.bot) {
    if (content === "ocean stop") {
      switch (message.author.id) {
        case magnat:
          try {
            await message.react(guildEmoji(message.guild, "stonks"));
            if (generalVoice.members.has(client.user.id)) {
              await generalVoice.leave();
            }
            await message.channel.send(":ok_hand:");
          } catch (error) {
            console.log(error);
          }
          break;
        case swensey:
          if (prank) {
            prank = false;
            await message.react(guildEmoji(message.guild, "No"));
            await message.reply("no");
            client.setTimeout(async () => {
              await message.channel.send("In fact, just because you asked");
              client.setTimeout(() => startOceanMan(generalVoice), 1 * 1000);
            }, 2 * 1000);
            break;
          }
        default:
          await message.react(guildEmoji(message.guild, "notstonks"));
          await message.reply("no");
          break;
      }
    } else if (content.includes("ocean man")) {
      startOceanMan(generalVoice);
    } else if (content === "ocean curse") {
      if (generalVoice.members.has(message.author.id)) {
        const user = await message.guild.members.fetch(cursedMember);
        const reply = await message.reply(
          `The curse is on ${
            user ? user.displayName : "UNKOWN"
          }. Self destruct in 15 seconds.`
        );
        client.setTimeout(() => {
          reply.delete();
        }, 15 * 1000);
      } else {
        await message.react(guildEmoji(message.guild, "stupid"));
        await message.reply(
          "You have to join the general voice channel to see who has the curse."
        );
      }
    } else if (
      message.author.id === cursedMember &&
      content.split(" ").length === 2 &&
      content.split(" ")[0] === "ocean"
    ) {
      try {
        const curse = content.split(" ")[1];
        const curseIsId = !!parseInt(curse);
        const newCursedMember = curseIsId
          ? await message.guild.members.fetch(curse)
          : (await message.guild.members.fetch()).find(
              (member) => member.user.tag.toLowerCase() === curse.toLowerCase()
            );
        if (newCursedMember) {
          await message.react(guildEmoji(message.guild, "Sabotage"));
          const reply = await message.reply(
            `Cursing ${newCursedMember.displayName}. Self destruct in 15 seconds.`
          );
          client.setTimeout(() => {
            reply.delete();
          }, 15 * 1000);

          cursedMember = newCursedMember.user.id;
        }
      } catch (error) {
        console.log(error);
      }
    }
  }
});

client.once("shardDisconnect", () => {
  console.log("OceanCurse disconnected");
  client.removeAllListeners();
  client.destroy();
});

client.login("ODEyODYwMDkxNzU3MjMyMjAw.YDG49A.CyeYwzwQ3FMVOM6WCfuwMxX7uts");
