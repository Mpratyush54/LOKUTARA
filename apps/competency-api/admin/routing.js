// declarations
const express = require('express')
const app = express.Router()


// Middleware
// TBT when we get authentication scheme
app.use('/',(req,res,next)=>{
    // const jwt_token = req.headers.x-token
    // const email = req.headers.x-email
    // const username = req.headers.x-username
    console.log("iwassssssssss");
    
    next()

}) 

app.use('/new-test', require('./test-entry'))

// exporting the module
module.exports = app