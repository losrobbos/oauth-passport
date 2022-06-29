require("dotenv").config() // load .env into process.env object
const express = require('express');
const app = express();
const passport = require("passport")
const session = require("express-session")
const logger = require("morgan")
let GitHubStrategy = require("passport-github").Strategy

let user = {}

app.use(logger("dev"))
app.use(session({
  secret: "hahohe",
  saveUninitialized: false,
  resave: false
}))

// IMPORTANT => we must initialize passport session AFTER we loaded generic express-session library 

// register passport middleware
app.use(passport.initialize()) // this will trigger the call of "serializeUser" function to create a session & cookie

// this will passport handle local login sessions
// THIS will trigger the call to "deserializeUser" upfront a route call!
// this way we can handle creation / recreations of local sessions
app.use(passport.session()) 


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
 * to the callbackURL /auth/github/calback
 * - The Social Provider alongside sends a short lived CODE to us in the URL
 * - Now Passport will exchange that received code against an accessToken
 *   - the accessToken grants us permission to get profile data!
 * - The exchange is triggered by calling passport.authenticate("provider") again!
 * - Now we land at the Strategy CALLBACK function
 *   - here we finally have an accessToken and the user profile data
 *   - now it is safe that the authentication part worked
 *   - we can now store / update the received info in our database
 *   - => so the callback is the right place to make our DATABASE operation
 * - Finally passport will now call "serializeUser"
 *    - we need to provide that function to now provide auth info to the FRONTEND
 *    - we can e.g. attach the user identifier in a cookie manually
 *    - or we let passport handle the whole session flow by installing the express-session lib
 *  - At the end passport redirects us to the "successRedirect" URL
 *  - We can here either show the user profile information
 *  - Or, in case we have e.g. a separate React frontend - redirect to that frontend
 *    - here we also would send the authentication info along
 *    - so either we send a cookie back or a JWT token in the URL or a response header
 *  - And that is finally it. That is the whole passport flow
 */
// register GitHub login provider at passport
passport.use(githubStrategy);
// passport.use(googleStrategy)
// passport.use(facebookStrategy)


// serializeUser will get called immeditely after the STRATEGY CALLBACK
// here we usually now prepare the SESSION with the frontend
// we can decide which parts of the user info we want to store in the session
// or we can also ignore sessions entirely
//
// in order to store we call the "done" callback 
// with the user data we want to pack into the session
//
// in order for passport to be able to STORE and re-create sessions on future calls:
// we additionally need to install and setup the "express-session" library 

// in case we want to manage the session differently, e.g. with a JWT header,
// we can simply just call the done function here and create the JWT info later
passport.serializeUser(async (userGithub, done) => {
  console.log("[PASSPORT] SERIALIZE USER called");
  userGithub._json = undefined
  userGithub._raw = undefined
  console.log(userGithub)
  user = userGithub // store the received user in database
  
  done(null, userGithub.id) // serialize just ID of user
  // done(null, userGithub); // serialize FULL user

});

// deserializeUser is called each time we visit out API
// deserializeUser will, in the background, read the infomration from the cookie the frontend sent to us
// and store it in the session 
// read userId from session 
// and read FULL user info (e.g. from database) into req.user
// by calling the "done" callback at the end, we can decide what info should get stored inside req.user 
// so the endresult of deserializeUser is => the authenticated user info stored in req.user variable
passport.deserializeUser(async (userId, done) => {
  console.log("[PASSPORT] DESERIALIZE USER called");
  console.log("- UserID in session: ", userId)
  console.log("- Deserialized user: ", user)

  // store user OBJECT in session (fake "database" user lookup ;))
  done(null, user);
});

// route which will redirect us to github for authenticing (loggin us in)
app.get('/auth/github', passport.authenticate('github'));

// CALLBACK route which will wait for the login response...
  // handles both: successful logins or login cancelation
app.get('/auth/github/callback', 
  (req, res, next) => {
    console.log("[CALLBACK URL]", req.url)
    console.log("- Autenticated?", req.isAuthenticated())
    next()
  },
  passport.authenticate('github', { 
    successRedirect: '/profile',
    failureRedirect: '/' // or /login
    //failureRedirect: 'http://localhost:3000/login' //absolute URL to frontend works too!!
  }),

);

const authLocal = (req, res, next) => {
  if(!req.isAuthenticated()) {
    return res.status(401).json({
      error: "Not authenticated, buddy"
    })
  }
  next()
}

// protect by session? passport.authenticate("session"), 
app.get("/profile", authLocal, (req, res) => {
  console.log("[PROFILE]")
  console.log("- Authenticated: ", req.isAuthenticated())
  console.log("- Session: ", req.session)
  console.log("- User: ", req.user)
  const { username, profileUrl } = user

  res.send(`
    <h1>User Profile</h1>
    <div>Session User: ${req.session?.passport?.user}</div>
    <div>Username: ${username}</div>
    <div>URL: ${profileUrl}</div>    
    <div><a href="/">Back to Home</a></div>    
  `)
})

app.get('/', (req, res) => {
  console.log("[HOMEPAGE]")
  console.log("- Autenticated?", req.isAuthenticated())
  console.log("- Session: ", req.session)

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

