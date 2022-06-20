require("dotenv").config() // load .env into process.env object
const express = require('express');
const app = express();
const passport = require("passport")
const jwt = require("jsonwebtoken")
const logger = require("morgan")
let GitHubStrategy = require("passport-github").Strategy

let user = {}

app.use(logger("dev"))

// create config object
const env = {
  clientId: process.env.CLIENT_ID,
  clientSecret: process.env.CLIENT_SECRET,
  callbackUrl: process.env.CALLBACK_URL
}

console.log("Our config values: ", env)

// Setting up password strategy

// create an instance of GitHubStrategy
let githubStrategy = new GitHubStrategy(
  {
    clientID: env.clientId,
    clientSecret: env.clientSecret,
    // callbackURL: env.callbackUrl
  },
  // LOGIN CALLBACK
  // this will get called AFTER successful EXCHANGE of the CODE with an ACCESS TOKEN
  (accessToken, refreshToken, profile, callback) => {
    // profile => contains github profile information
    console.log("[LOGIN / STRATEGY CALLBACK]")
    console.log({ profile })
    console.log( "Data: ", profile.username, profile.profileUrl, accessToken)
    callback(null, profile) // tell GitHub we successfully received the user info
    // by this confirmation, it will forward us finally to the CALLBACK url

  // If we use database => store user in DB and confirm afterwards...
  // User.findOrCreate({ githubId: profile.id }, function (err, user) {
  //   return cb(err, user);
  // });
  }
)

/**
 * PASSPORT FLOW
 * 
 * - /auth/github => redirect user to GitHub login page
 * - the redirect is done by calling the passport.authenticate("provider") middleware
 * - Once GitHub authenticated that user, GitHub will send us back
 * to the callbackURL /auth/github/callback
 * - The Social Provider alongside sends a short lived CODE to us in the URL
 * - Now Passport will exchange that received code against an accessToken
 *   - the accessToken grants us permission to get profile data!
 * - The exchange is triggered by calling passport.authenticate("provider") again!
 * - Now we land at the Strategy CALLBACK function
 *   - here we finally have an accessToken and the user profile data
 *   - now it is safe that the authentication part worked
 *   - we can now store / update the received info in our database
 *   - => so the callback is the right place to make our DATABASE operation
 *  - At the end passport redirects us to the "successRedirect" or instead another callback
 *  - here we can now handle the JWT creation and redirect to the frontend with the JWT
 *    - because we cannot append headers in a redirect we need to attach the JWT to the URL
 *  - And that is finally it. That is the whole passport flow
 */
// register GitHub login provider at passport
passport.use(githubStrategy);
// passport.use(googleStrategy)
// passport.use(facebookStrategy)


// route which will redirect us to github for authenticing (loggin us in)
app.get('/auth/github', passport.authenticate('github', { 
  session: false, 
  scope: process.env.SCOPES?.split(",") // request scopes / privileges you want to have access to
}));

// CALLBACK route which will wait for the login response...
  // handles both: successful logins or login cancelation
app.get('/auth/github/callback', 
  (req, res, next) => {
    console.log("[CALLBACK / REDIRECT FROM LOGIN PROVIDER]")
    next()
  },
  passport.authenticate('github', { 
    session: false,
    // if user declined => do not create any JWT or anything else => just redirect
    failureRedirect: '/' // or /login
    //failureRedirect: 'http://localhost:3000/login' //absolute URL to frontend works too!!
  }),

  // this callback handles SUCCESSFUL login
  // here we can create our JWT token and redirect MANUALLY
  (req, res) => {
    console.log("[FINAL CALLBACK]")
    // Successful authentication, redirect home.
    console.log("- Login was succesful")
    // res.json("You are logged in!")

    const tokenData = {
      _id: req.user.id,
      username: req.user.username,
      profileUrl: req.user.profileUrl,
    }
    const token = jwt.sign(tokenData, process.env.JWT_SECRET)

    // REDIRECT TO FRONTEND AT THE END TO DISPLAY .e.g. PROFILE INFORMATION
    res.redirect(`/profile?token=${token}`)
  }
);

// check if user provided a valid JWT either in header or URL param "token"
const authLocal = (req, res, next) => {

  const token = req.headers.token || req.query.token

  // verify token
  try {
    const decodedUser = jwt.verify(token, process.env.JWT_SECRET)
    req.user = decodedUser
    next()
  }
  catch(err) {
    res.status(401).json({
      error: "Not authenticated, buddy"
    })
  }
}

// protected route 
// => only accessible if we provide a valad JWT in either header "token" or URL param "token"
app.get("/profile", authLocal, (req, res) => {
  console.log("[PROFILE]")
  console.log("- User: ", req.user)
  const { username, profileUrl } = user

  res.send(`
    <h1>User Profile</h1>
    <div>Username: ${req.user?.username}</div>
    <div>URL: ${req.user?.profileUrl}</div>    
    <div><a href="/">Back to Home</a></div>    
  `)
})

app.get('/', (req, res) => {
  console.log("[HOMEPAGE]")
  console.log("- User: ", req.user)

  res.send(`
    <h1>Login Options</h1>
    <a href="/auth/github">GitHub Login</a>
    <a href="/profile">User Profile</a>
  `)
});

let PORT = process.env.PORT || 5000
app.listen(PORT, () => {
  console.log(`Server listening on: http://localhost:${PORT}`)
});

