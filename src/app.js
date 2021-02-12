import { MessageEmbed, WebhookClient } from 'discord.js';
import fs from 'fs/promises';
import latestVersion from 'latest-version';

const filename = 'versions.json';

/**
 * @type { [string, string][] }
 */
const npmWatchlist = [
    ['create-svelte', 'next'],
    ['@sveltejs/kit', 'next'],
    ['@sveltejs/app-utils', 'next'],
    ['@sveltejs/snowpack-config', 'next'],
    ['@sveltejs/adapter-node', 'next'],
    ['@sveltejs/adapter-netlify', 'next'],
    ['@sveltejs/adapter-vercel', 'next'],
    ['@sveltejs/adapter-static', 'next'],
];

/**
 * @return { Promise<Record<string, string>[]> }
 */
async function loadVersions() {
    try {
        const data = await fs.readFile(filename);
        return JSON.parse(data.toString());
    } catch (e) {
        console.error(
            'Failed loading the version list; using an empty list instead'
        );
        console.error(e);
        return {};
    }
}

/**
 *
 * @param { Record<string, string>[] } versionList
 */
async function saveVersions(versionList) {
    try {
        await fs.writeFile(filename, JSON.stringify(versionList));
    } catch (e) {
        console.error('Failed saving the version list');
        console.error(e);
    }
}

/**
 *
 * @param { [string, string][] } list
 * @return { [string, string][][] }
 */
function batch10(list) {
    const size = 10;
    if (list.length > size) {
        return [list.slice(0, size), ...batch10(list.slice(size))];
    } else {
        return [list];
    }
}

/**
 *
 * @param { WebhookClient } webhookClient
 * @param { [string, string][] } batch
 */
async function sendDiscordEmbed(webhookClient, batch) {
    const embeds = batch.map(([moduleName, version]) => {
        return new MessageEmbed()
            .setColor('#e32e37')
            .setTitle(moduleName)
            .setURL(`https://www.npmjs.com/package/${moduleName}`)
            .setDescription(version)
            .setTimestamp();
    });
    return await webhookClient.send('', { embeds });
}

async function main() {
    // load current versions
    const currentVersions = await loadVersions();

    /**
     * @type { [string, string][] }
     */
    const updateQueue = [];

    // check latest versions of watchlist
    for (const [moduleName, version] of npmWatchlist) {
        /**
         * @type { string | undefined }
         */
        const current = currentVersions[moduleName];
        const latest = await latestVersion(moduleName, {
            version,
        });
        if (current !== latest) {
            updateQueue.push([moduleName, latest]);
            currentVersions[moduleName] = latest;
        }
    }

    // batch queue into groups of 10 (max embeds per post)
    const batchedQueue = batch10(updateQueue);
    const webhookClient = new WebhookClient(
        process.env.WEBHOOK_ID,
        process.env.WEBHOOK_TOKEN
    );

    // process update queue
    for (const batch of batchedQueue) {
        if (batch.length === 0) {
            continue;
        }
        try {
            await sendDiscordEmbed(webhookClient, batch);
        } catch (e) {
            console.error(e);
        }
    }

    // save new versions
    await saveVersions(currentVersions);

    process.exit();
}

main();
