require('dotenv').config();
const { MongoClient } = require('mongodb');

async function check() {
    const uri = process.env.MONGODB_URI;
    console.log("URI:", uri ? "found" : "missing");
    const client = new MongoClient(uri);
    await client.connect();
    const db = client.db();

    const doc = await db.collection('config').findOne({ _id: 'launch_status' });
    console.log("DB Document:", doc);

    await client.close();
}
check().catch(console.error);
