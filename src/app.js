import express from "express";
import cors from "cors";
import { MongoClient } from "mongodb";
import dotenv from "dotenv";
import dayjs from "dayjs";
import Joi from "joi";

const app = express();

app.use(cors());
app.use(express.json());
dotenv.config();


let db;
const mongoClient = new MongoClient(process.env.DATABASE_URL);
mongoClient.connect()
    .then(() => db = mongoClient.db())
    .catch((err) => console.log(err.message))

const currentDate = dayjs(); //Data atual
const currentTime = currentDate.format('HH:mm:ss'); //Data no formato correto

//setInterval(removeUsers, 15000);

app.post("/participants", async (req, res) => {

    const { name } = req.body;
    const userSchema = Joi.object({
        name: Joi.string().required()
    });

    try {

        const { error } = userSchema.validate(req.body);

        if (error) return res.sendStatus(422);

        const searchUsers = await db.collection("participants").find({ name }).toArray()

        if (searchUsers.length > 0) return res.sendStatus(409);

        const newUser = { name, lastStatus: Date.now() };
        const newMessage = { from: name, to: 'Todos', text: 'entra na sala...', type: 'status', time: currentTime };

        await db.collection("participants").insertOne(newUser);
        await db.collection("messages").insertOne(newMessage);

        res.sendStatus(201);
    } catch (err) {
        res.status(500).send(err.message);
    }
});
app.get("/participants", async (req, res) => {
    try {
        const allParticipants = await db.collection("participants").find().toArray()
        res.send(allParticipants);
    } catch (err) {
        res.status(500).send(err.message);
    }

});

app.post("/messages", async (req, res) => {

    const { to, text, type } = req.body;
    const { user } = req.headers;

    function verifyBody(req) {
        if (req.body) {
            return { ...req.body, from: user }
        }

        return req;
    }

    const newBody = verifyBody(req);

    const messageBodySchema = Joi.object({
        from: Joi.string().required(),
        to: Joi.string().required(),
        text: Joi.string().required(),
        type: Joi.string().valid("message", "private_message").required()
    });

    try {

        const { error: errorBody } = messageBodySchema.validate(newBody);

        if (errorBody) return res.status(422).send(errorBody.message);

        const userFromMessage = await db.collection("messages").find({ from: user }).toArray()

        if (userFromMessage.length === 0) return res.status(422).send("Usuário remetente não existe");


        const sendMessage = { from: user, to, text, type, time: currentTime };

        await db.collection("messages").insertOne(sendMessage);

        res.sendStatus(201);
    } catch (err) {
        res.status(500).send(err.message);
    }

});
app.get("/messages", async (req, res) => {

    const { limit } = req.query;
    const { user } = req.headers;

    const limitSchema = Joi.number()
        .integer()
        .min(1)
        .required();

    try {

        const searchMessages = await db.collection("messages").find
            ({
                $or: [
                    { type: "message" },
                    { type: "private_message", to: "Todos" },
                    { type: "private_message", to: user },
                    { type: "private_message", from: user }
                ]
            }).toArray()

        if (limit) {

            const { error: errorLimit } = limitSchema.validate(limit);

            if (errorLimit) {
                res.status(422).send(errorLimit.message)
            } else {
                res.send(searchMessages.slice(-limit));
            }
        } else {
            res.send(searchMessages);
        }
    } catch (err) {
        res.status(500).send(err.message);
    }

});
app.post("/status", async (req, res) => {

    const { user } = req.headers;

    try {

        if (!user) return res.sendStatus(404);

        const findNewUser = await db.collection("participants").find({ name: user }).toArray()

        if (findNewUser.length === 0) return res.sendStatus(404);

        const refreshedUser = { name: user, lastStatus: Date.now() };

        await db.collection("participants").insertOne(refreshedUser);
        console.log(refreshedUser)

        res.sendStatus(200)
    } catch {
        res.status(500).send(err.message);
    }
});

const PORT = 5000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));