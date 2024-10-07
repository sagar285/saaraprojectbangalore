const { createClient } = require('redis');
require("dotenv").config();

// redis client created
const client = createClient({
    username:"default",
    password: process.env.REDIS_PASSWORD,
    socket: {
        host: 'redis-10752.c273.us-east-1-2.ec2.redns.redis-cloud.com',
        port: 10752
    }
});

client.on('error', (err) => {
    console.log('Redis Client Error', err);
});

client.connect().then(() => {
    console.log('Redis client connected');
}).catch((err) => {
    console.error('Error connecting to Redis', err);
});

module.exports = client;