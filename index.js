require('dotenv').config();
const { Client, GatewayIntentBits, PermissionsBitField } = require('discord.js');
const cron = require('node-cron');
const fs = require('fs');
const csv = require('csv-parser');
const express = require('express');
const app = express();

// Initialize Express app and define the endpoint
app.get('/', (req, res) => {
  res.send('Bot is awake!');
});

// Initialize web server 
const port = process.env.PORT || 3000;
app.listen(port, () => {
  logger.info(`Web server listening on port ${port}`);
});


// Channel and Thread IDs
const SUBMISSION_CHANNEL_ID = '1403174534764564563';
const PRIVATE_THREAD_ID = '1401021916910719029';
const GUILD_ID = '1401018909242429512'; 
const CSV_FILE_PATH = './members.csv';

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers // We need this intent to manage members
    ]
});

// Counter for connection attempts and constraints for exp. backoff
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;
const BASE_DELAY = 1000; // 1 second

// Listener for successful connection
client.on('ready', () => {
  logger.info(`[EVENT] Bot is now online and connected as ${client.user.tag}!`);
  reconnectAttempts = 0;
});

// Listener for shard disconnect
client.on('shardDisconnect', (event, id) => {
  logger.info(`Shard ${id} disconnected with code ${event.code}.`);
  
  if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    logger.error('[FATAL] Max reconnection attempts reached. Shutting down.');
    process.exit(1);
    return;
  }

  // Calculate the exponential backoff delay with jitter
  const delay = Math.min(BASE_DELAY * Math.pow(2, reconnectAttempts) + Math.random() * 1000, 30000); // Max delay of 30 seconds
  reconnectAttempts++;

  logger.info(`Attempting to reconnect in ${delay / 1000} seconds. (Attempt ${reconnectAttempts})`);

  setTimeout(() => {
    client.login(process.env.DISCORD_TOKEN);
  }, delay);
});

// Listener for when the bot is actively trying to reconnect.
client.on('reconnecting', () => {
  logger.warn('[EVENT] Bot is attempting to reconnect...');
});

// Listener for a successful connection resume.
client.on('resume', id => {
    logger.info(`[EVENT] Shard ${id} successfully resumed its connection.`);
});

// Listener for client errors
client.on('error', err => {
  logger.error('[FATAL ERROR] An unexpected client error occurred', err);
});

// Listener for client warnings
client.on('warn', info => {
  logger.warn('[WARNING] A client warning was received:', info);
});

// Listener for process
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Optional: Restart the bot or shut down gracefully
});





// A function to check the CSV file and perform actions
const processMembersFile = async () => {
    // Helper function to check if two Date objects represent the same day
    const isSameDay = (d1, d2) => {
        return d1.getFullYear() === d2.getFullYear() &&
               d1.getMonth() === d2.getMonth() &&
               d1.getDate() === d2.getDate();
    };

    const today = new Date(); // Get today's date object
    logger.info(`Today's date: ${today.toDateString()}`); // Log today's date for debugging

    const results = [];

    // Read and parse the CSV file
    fs.createReadStream(CSV_FILE_PATH)
        .pipe(csv())
        .on('data', (data) => results.push(data))
        .on('end', async () => {
            const privateThread = await client.channels.fetch(PRIVATE_THREAD_ID);
            const guild = await client.guilds.fetch(GUILD_ID);

            if (!privateThread || !guild) {
                logger.error('Error: Could not find the private thread or guild. Check IDs.');
                return;
            }

            for (const row of results) {
                // Parse the date from the CSV row.
                // JavaScript's Date constructor can often parse MM/DD/YYYY, but it's locale-dependent.
                // For robust parsing, a library like 'moment.js' or 'date-fns' is ideal,
                // but for simplicity, we'll rely on native parsing for now.
                const actionDate = new Date(row.date);

                // Log the parsed date and the comparison for debugging
                logger.info(`Processing row: User ID: ${row.user_id}, Action: ${row.action}, CSV Date: ${row.date}`);
                logger.info(`Parsed action date: ${actionDate.toDateString()}`);
                logger.info(`Date comparison (isSameDay): ${isSameDay(actionDate, today)}`);

                // Check if the parsed date is valid and matches today's date
                if (!isNaN(actionDate.getTime()) && isSameDay(actionDate, today)) {
                    const member = await guild.members.fetch(row.user_id).catch(err => {
                        logger.error(`Error fetching member ${row.user_id}:`, err);
                        return null; // Return null if member not found
                    });

                    if (!member) {
                        logger.error(`Skipping action for user ID ${row.user_id}: Member not found in guild.`);
                        continue;
                    }
                    
                    if (row.action.toLowerCase() === 'add') { // Use .toLowerCase() for robustness
                        try {
                            await privateThread.members.add(member.user.id);
                            logger.warn(`Successfully added ${member.user.tag} to the private thread.`);
                        } catch (error) {
                            logger.error(`Failed to add member ${member.user.tag} to thread:`, error);
                            // You might want to reply to an admin channel here for persistent notifications
                        }
                    } else if (row.action.toLowerCase() === 'remove') { // Use .toLowerCase() for robustness
                        try {
                            await privateThread.members.remove(member.user.id);
                            logger.info(`Successfully removed ${member.user.tag} from the private thread.`);
                        } catch (error) {
                            logger.error(`Failed to remove member ${member.user.tag} from thread:`, error);
                            // You might want to reply to an admin channel here for persistent notifications
                        }
                    } else {
                        logger.warn(`Unknown action '${row.action}' for user ID ${row.user_id}. Skipping.`);
                    }
                } else {
                    logger.info(`Skipping row for user ID ${row.user_id}: Date mismatch or invalid date.`);
                }
            }
        });
};

client.once('ready', () => {
    logger.info(`Ready! Logged in as ${client.user.tag}`);
    // Schedule the task to run every day at 12:01 AM
    cron.schedule('1 0 * * *', () => {
        logger.info('Running daily member adjustment check...');
        processMembersFile();
    }, {
        timezone: "America/Los_Angeles" // Change this to your timezone
    });
});

client.on('messageCreate', async message => {
    // Ignore messages from other bots
    if (message.author.bot) return;

    // --- PING TEST LOGIC ---
    if (message.content.toLowerCase() === '!ping') {
        message.reply('Pong!');
        return; // Important: return here so it doesn't try other commands
    }

    // --- SUBMISSION LOGIC ---
    // Check if the message is in the designated public submission channel
    if (message.channel.id === SUBMISSION_CHANNEL_ID) {
        // Check for a text-based submission command
        if (message.content.startsWith('!submit ')) {
            const submissionText = message.content.substring('!submit '.length).trim();

            if (submissionText === '') {
                message.reply("You must provide text after the `!submit` command.");
                return;
            }

            const privateThread = await client.channels.fetch(PRIVATE_THREAD_ID);

            if (privateThread) {
                // Forward the text submission
                privateThread.send(`**New Submission from ${message.author.username}:**\n\n${submissionText}`);
                
                try {
                    await message.delete();
                } catch (error) {
                    logger.error('Failed to delete message:', error);
                }
            } else {
                message.reply('Error: Could not find the private thread. Check IDs.');
            }
            return; // Important: return after handling submission
        } 
        // Check for a photo-only submission (only if no text command)
        else if (message.attachments.size > 0 && message.content === '') {
            const privateThread = await client.channels.fetch(PRIVATE_THREAD_ID);
            
            if (privateThread) {
                // Forward the photo submission and store the sent message
                const sentMessage = await privateThread.send({
                    content: `**submission from ${message.author.username}:**`,
                    files: [...message.attachments.values()]
                });

                // Send a poll as a reply to the sent photo message
                await sentMessage.reply({
                    content: '--- Potential CUCK Offer: ---', // Explicit content for the message
                    poll: { // Changed from 'polls' to 'poll'
                        question: { text: 'Is this offer sus?' },
                        answers: [
                            { text: 'Yes' },
                            { text: 'No' }
                        ],
                        duration: 24, // Poll lasts for 24 hours
                        allow_multiselect: false // Changed from 'allowMultiselect' to 'allow_multiselect'
                    }
                });

                // Delete the original message from the public channel for privacy
                try {
                    await message.delete();
                } catch (error) {
                    logger.error('Failed to delete message:', error);
                }

                // Notify all members of private thread to prompt them to vote
                const threadMembers = await privateThread.members.fetch();
                const humanMembers = threadMembers.filter(member => !member?.user?.bot);
                const mentions = humanMembers.map(member => `<@${member.id}>`);
                const mentionMessage = `Hey ${mentions.join(', ')}, vote on this submission in the C.U.C.K. Council`;
                await privateThread.send(mentionMessage);

            } else {
                message.reply('Error: Could not find the private thread.');
            }
            return; // Important: return after handling photo submission
        }
    }

    // --- TEMPORARY POLL TEST COMMAND ---
    if (message.content.toLowerCase() === '!testpoll') {
        try {
            await message.channel.send({
                content: 'Poll initiated:', // Explicit content for the message
                poll: { // Changed from 'polls' to 'poll'
                    question: { text: 'Is this a working poll?' },
                    answers: [
                        { text: 'Yes' },
                        { text: 'No' }
                    ],
                    duration: 24, // Poll lasts for 24 hours
                    allow_multiselect: false // Changed from 'allowMultiselect' to 'allow_multiselect'
                }
            });
            logger.info('Attempted to send minimal test poll.'); // Log success internally
            message.reply('Test poll command processed. Check channel for poll!'); // Confirmation to user
        } catch (error) {
            logger.error('Failed to send minimal test poll (caught error):', error);
            message.reply('Failed to send minimal test poll. Check console for errors.');
        }
        return; // Stop processing further commands
    }

    

    // --- MEMBER ADJUSTMENT LOGIC (Commands can be used in any channel) ---
    // Check if the user has a Discord admin role in the server
    const isServerAdmin = message.member.permissions.has(PermissionsBitField.Flags.Administrator);

    if (message.content.startsWith('!addmember ') && isServerAdmin) {
        const member = message.mentions.members.first();
        const privateThread = await client.channels.fetch(PRIVATE_THREAD_ID);

        if (member && privateThread) {
            try {
                await privateThread.members.add(member.user.id);
                message.reply(`${member.user.username} has been added to the private thread.`);
            } catch (error) {
                logger.error('Failed to add member to thread:', error);
                message.reply('Could not add the member. Check the bot\'s permissions or the user\'s status.');
            }
        } else {
            message.reply('Error: Could not find the user or the private thread. Please mention a valid user.');
        }
        return; // Important: return after handling addmember
    }

    if (message.content.startsWith('!removemember ') && isServerAdmin) {
        const member = message.mentions.members.first();
        const privateThread = await client.channels.fetch(PRIVATE_THREAD_ID);

        if (member && privateThread) {
            try {
                await privateThread.members.remove(member.user.id);
                message.reply(`${member.user.username} has been removed from the private thread.`);
            } catch (error) {
                logger.error('Failed to remove member from thread:', error);
                message.reply('Could not remove the member. Check the bot\'s permissions.');
            }
        } else {
            message.reply('Error: Could not find the user or the private thread. Please mention a valid user.');
        }
        return; // Important: return after handling removemember
    }
});


client.login(process.env.DISCORD_TOKEN);