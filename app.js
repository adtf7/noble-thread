let express=require('express')
let app=express()
let env=require('dotenv').config()
let db=require('./config/db')
db()





app.listen(process.env.PORT,()=>{
    console.log('server running.........')
})

module.exports=app 