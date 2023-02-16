import { APIGatewayProxyHandler } from 'aws-lambda';
import Slack from '@slack/bolt'
import axios from 'axios';
import dateformat from "dateformat"
// @ts-ignore
import unescape from 'unescape';

const app = new Slack.App({
    token: process.env.SLACK_BOT_TOKEN,
    signingSecret: process.env.SLACK_SIGNING_SECRET!,
});

const gesSatisticst = async () => {
    const { data } = await axios.get('https://russianwarship.rip/api/v2/statistics/latest');

    return data.data
}

const getPostHtml = async (url: string): Promise<string> => {
    const formatPostUrl = (value: string) => {
        const url = new URL(value);

        if(url.searchParams.has('story_fbid'))
            return `https://m.facebook.com/MinistryofDefence.UA/posts/${url.searchParams.get('story_fbid')}`

        return value.replace('www', 'm')
    }

    try {
        const formatedUrl = formatPostUrl(url);

        const { data } = await axios.get(formatedUrl,
            {
                withCredentials: true,
                "headers": {
                    "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9",
                    "accept-language": "en-AU,en-US;q=0.9,en;q=0.8,uk;q=0.7",
                    "cache-control": "no-cache",
                    "pragma": "no-cache",
                    "sec-ch-ua": "\"Not_A Brand\";v=\"99\", \"Google Chrome\";v=\"109\", \"Chromium\";v=\"109\"",
                    "sec-ch-ua-mobile": "?0",
                    "sec-ch-ua-platform": "\"macOS\"",
                    "sec-fetch-dest": "document",
                    "sec-fetch-mode": "navigate",
                    "sec-fetch-site": "none",
                    "sec-fetch-user": "?1",
                    "upgrade-insecure-requests": "1",
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36'
                },
            });

        return data;
    } catch(error) {
        console.error(error);

        throw error;
    }
}

const extractImage = (html: string) => {
    const matches = /<meta property="og:image" content="(.*?)" \/>/gm.exec(html)

    return Promise.resolve(matches ? unescape(matches[1]) : null)
}

const getImage = async (url: string) => {
    const response = await axios.get(url, { responseType: 'arraybuffer' })
    return Buffer.from(response.data, "utf-8")
}

export const handler: APIGatewayProxyHandler = async (event, context, callback) => {
    const { date, resource } = await gesSatisticst();

    console.debug('hanlder', resource, date);

    const postHtml = await getPostHtml(resource);

    const image = await extractImage(postHtml)

    console.debug('image', image);

    if(!image) {
        return {
            statusCode: 500,
            body: 'Image not found'
        }
    }

    const result = await app.client.files.uploadV2({
        channel_id: process.env.SLACK_CHANNEL_ID!,

        file: await getImage(image),
        title: `The total combat losses of the enemy from 24.02.22 to ${dateformat(date, 'dd.mm.yy')} were approximately`,
        filename: `enemy-losses-${date}.png`
    });

    return {
        statusCode: 200,
        body: JSON.stringify(result)
    }
}