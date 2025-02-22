let express = require('express');
let app = express();
let path = require('path');
let dotenv = require('dotenv');
let db = require('./config/db');
let userRouter = require('./routes/userRouter');

dotenv.config();


db().catch(err => {
    console.error('Database connection failed:', err.message);
    process.exit(1); 
});


app.use(express.json());
app.use(express.urlencoded({ extended: true }));


app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views')); 

app.use(express.static(path.join(__dirname, 'public')));

app.use('/', userRouter);

app.use((req, res) => {
    res.status(404).render('error', { message: 'Page Not Found' });
});


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

module.exports = app;
 