require("dotenv").config() // load .env into process.env object
const express = require('express');
const app = express();
const passport = require("passport")
let GitHubStrategy = require("passport-github").Strategy

let user = {}

// register passport middleware
app.use(passport.initialize()) // this will parse login response


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
    callbackURL: env.callbackUrl
  },
  // LOGIN CALLBACK
  // this will get called AFTER successful authentication on the GitHub page
  (accessToken, refreshToken, profile, callback) => {
    // profile => contains github profile information
    console.log("[LOGIN RESPONSE]")
    console.log( profile.username, profile.profileUrl)
    callback(null, profile) // tell GitHub we successfully received the user info

  // If we use database => store user in DB and confirm afterwards...
  // User.findOrCreate({ githubId: profile.id }, function (err, user) {
  //   return cb(err, user);
  // });
  }
)

/**
 * PASSPORT FLOW
 * 
 * /auth/github => redirect user to GitHub login page
 * Once GitHub authenticated that user, GitHub will send me back
 * to the callbackURL
 * Social Provider alongside sens an accessToken to us
 * => accessToken grants us permission to get profile data
 */
// register GitHub login provider at passport
passport.use(githubStrategy);
// passport.use(googleStrategy)
// passport.use(facebookStrategy)


// receive incoming user and store it in session
passport.serializeUser(async (userGithub, done) => {
  console.log("[PASSPORT] SERIALIZE USER called");
  user = userGithub // store the received user in database
  done(null, userGithub);
});

// read received user out of session into object
passport.deserializeUser(async (user, done) => {
  console.log("[PASSPORT] DESERIALIZE USER called");
  console.log("Deserialized user: ", user)
  done(null, user);
});

// route which will redirect us to github for authenticing (loggin us in)
app.get('/auth/github', passport.authenticate('github'));

// CALLBACK route which will wait for the login response...
  // handles both: successful logins or login cancelation
app.get('/auth/github/callback', 
  passport.authenticate('github', { failureRedirect: '/login' }),

  // this here handles SUCCESSFUL login
  (req, res) => {
    console.log("[CALLBACK]")
    // Successful authentication, redirect home.
    console.log("Login was succesful")
    // res.json("You are logged in!")

    // REDIRECT TO FRONTEND AT THE END TO DISPLAY .e.g. PROFILE INFORMATION
    res.redirect('/profile')
    // res.redirect('http://localhost:3000/profile');
  });

app.get("/profile", (req, res) => {
  console.log("User: ", user)
  const { username, profileUrl } = user

  res.send(`
    <h1>User Profile</h1>
    <div>Username: ${username}</div>
    <div>URL: ${profileUrl}</div>    
    <div><a href="/">Back to Home</a></div>    
  `)
})

app.get('/', (req, res) => {
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

