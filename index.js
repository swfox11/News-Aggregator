import 'dotenv/config';
import express from "express";
import bodyParser from "body-parser";
import { dirname } from "path";
import { fileURLToPath } from "url";
import pg from "pg";
import bcrypt from "bcrypt";
import passport from "passport";
import { Strategy } from "passport-local";
import session from "express-session";
import axios from "axios";


const app = express();
const __dirname = dirname(fileURLToPath(import.meta.url));
const port = process.env.PORT;
const saltRounds = 10;
const API_URL_live = "https://newsapi.org/v2/top-headlines";
const API_URL_all= "https://newsapi.org/v2/everything";
const numberOfAPI=7;

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
  })
);

app.use(passport.initialize());
app.use(passport.session());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());

const db = new pg.Client({
  user: process.env.PG_USER,
  host: process.env.PG_HOST,
  database: process.env.PG_DATABASE,
  password: process.env.PG_PWD,
  port: process.env.PG_PORT,
  //ssl: true,
});
db.connect();


//function to call different api keys each time efficiently
async function getAPI() {
  let serial = await db.query("SELECT * FROM serial_news_aggregator WHERE id = $1 ",
  [ 1 ]);

  let num=parseInt(serial.rows[0].num);
  num+=1;
  num%=numberOfAPI;
  
  await db.query(
    "UPDATE serial_news_aggregator SET num=$1 WHERE id=$2",
    [num,1]
  );
   if (num===0) {
      return process.env.API_KEY0;
   }
   else if (num===1) {
    return process.env.API_KEY1;
   }
   else if (num===2) {
    return process.env.API_KEY2;
   }
   else if (num===3) {
    return process.env.API_KEY3;
   }
   else if (num===4) {
    return process.env.API_KEY4;
   }
   else if (num===5) {
    return process.env.API_KEY5;
   }
   else if (num===6) {
    return process.env.API_KEY6;
   }
  
}

app.get("/", async (req, res) => {
  //const searchId = req.body.id;
  try {
    res.render("Home.ejs");
    //console.log((result.data.articles));
  } catch (error) {
    //res.render("index.ejs", { content: JSON.stringify(error.response.data) });
    console.log(error);
  }
});

app.get("/auth/Home", async (req, res) => {
  //const searchId = req.body.id;
  
     try {
          if (req.isAuthenticated) {
          res.render("Homeauth.ejs");
          }
          else{
            res.redirect("/loginsignup");
          }
        //console.log((result.data.articles));
      } catch (error) {
    //res.render("index.ejs", { content: JSON.stringify(error.response.data) });
        console.log(error);
      }
  

});

app.get("/user",async (req,res)=>{
    if (req.isAuthenticated()) {
       //get hold of user url from db if not found then redirect to /auth/Home
       try {
           let result = await db.query("SELECT * FROM users_news_aggregator WHERE email = $1", [
            req.user.email
          ]);
         if (result.rows.url!==null) {
          let url=result.rows[0].url;
          let output = await axios.get(url);
          //console.log(url);
          res.render("user.ejs", { array: (output.data.articles), user:req.user.email });
         }
         else{
          res.redirect("/auth/Home");
         }
       } catch (error) {
          console.log(error);
       }
         console.log(req.user);
       //res.render("user.ejs",{})
    }
    else
    {
      res.redirect("/loginsignup");
    }
});

app.get("/loginsignup",(req,res)=>{
  res.render("loginsignup.ejs");
})
app.get("/live", async (req, res) => {
    //const searchId = req.body.id;
    try {
      //console.log(req.body);
      let key=await getAPI();
      
      const result = await axios.get(`${API_URL_live}?language=en&pageSize=100&apiKey=${key}` );
      res.render("live.ejs", { array: (result.data.articles) });
      //console.log((result.data.articles));
    } catch (error) {
      //res.render("index.ejs", { content: JSON.stringify(error.response.data) });
      console.log(error);
    }
  });

  

  app.get("/auth/live", async (req, res) => {
    //const searchId = req.body.id;
    
      try {
            if(req.isAuthenticated())
            {
                  //console.log(req.body);
                  
                  res.render("liveauth.ejs");
            }else{
              res.redirect("/loginsignup");
            }
          
          } catch (error)
          {
          
           console.log(error);
          }
    
    
  });

  app.post("/auth/live" ,async (req,res)=>{
    console.log(req.body);
     if (req.isAuthenticated()) 
    {
      try {
      let url=`${API_URL_live}?pageSize=100`;
      let noParameterSet=true;
      if (req.body.country!==undefined) {
        url+=`&country=${req.body.country}`;
        noParameterSet=false;
      }
      if (req.body.category!==undefined) {
        url+=`&category=${req.body.category}`;
        noParameterSet=false;
      }
      if ((req.body.searchQuery!=='')&&(req.body.searchQuery!==undefined)) {
        url+=`&q=${req.body.searchQuery}`;
        noParameterSet=false;
      }
      if (noParameterSet===true) {
        //url+=`language=en`;
        res.render("liveauth.ejs");
      }
      else
      {
        let key=await getAPI();
      url+=`&apiKey=${key}`;

      console.log(url);
      try {
        
           await db.query(
            "UPDATE users_news_aggregator SET url=$1 WHERE email=$2",
            [url,req.user.email]
          );
      } catch (error) {
        console.log(error);
      }
      //store url in db.(if already present then replace)
      const result = await axios.get(url);
      res.render("user.ejs", { array: (result.data.articles),user:req.user.email });
    }
      //console.log((result.data.articles));
    } catch (error) {
      //res.render("index.ejs", { content: JSON.stringify(error.response.data) });
      console.log(error);
    }
  }
  else{
    res.redirect("/loginsignup");
  }
    //console.log(country);
  });

  app.get("/login",(req,res)=>{
    if(req.session.messages!=null)
    {
        let msg=req.session.messages[0];
        res.render("login.ejs",{message:msg});
    }
    else{
        res.render("login.ejs");
    }
    
})

app.get("/logout", (req, res) => {
  req.logout(function (err) {
    if (err) {
      return next(err);
    }
    res.redirect("/");
  });
});

app.get("/signup",(req,res)=>{
    res.render("signup.ejs");
})


app.get("/bookmark",async (req,res)=>{
  try {
    
    if (req.isAuthenticated()) {

      const result = await db.query("SELECT * FROM bookmarks_news_aggregator WHERE email = $1",
       [req.user.email]
       );
      
       if (result.rows.length > 0)
        {
          console.log(result.rows);
         res.render("bookmarks.ejs", { array: (result.rows),user:req.user.email });
        
        } else {
      res.render("bookmarks.ejs", { user:req.user.email });
       }
      

      
    }
    else{
      res.redirect("/loginsignup");
    }
  } catch (error) {
      console.log(error);
  }

   


});

app.post("/bookmark",async (req,res)=>{
  try {
    
    if (req.isAuthenticated()) {
      console.log(req.body);
      await db.query(
        "INSERT INTO bookmarks_news_aggregator (email ,title, urlToImage,description,url,content,sourcename,author,publishedAt) VALUES ($1, $2,$3,$4,$5,$6,$7,$8,$9) ",
        [req.user.email,req.body.title,req.body.urlToImage,req.body.description,req.body.url,req.body.content,req.body.sourcename,req.body.author,req.body.publishedAt]
      );
      res.status(204).send();
    }
    else{
      res.redirect("/loginsignup");
    }
  } catch (error) {
      console.log(error);
  }

   


});
  app.post("/live" ,async (req,res)=>{
    console.log(req);

    try {
      let noParameterSet=true;
      let url=`${API_URL_live}?pageSize=100`;
      if (req.body.country!==undefined) {
        noParameterSet=false;
        url+=`&country=${req.body.country}`;
      }
      if (req.body.category!==undefined) {
        noParameterSet=false;
        url+=`&category=${req.body.category}`;
      }
      if ((req.body.searchQuery!=='')&&(req.body.searchQuery!==undefined)) {
        noParameterSet=false;
        url+=`&q=${req.body.searchQuery}`;
      }
      if (noParameterSet===true) {
        url+=`language=en`;
        res.render("live.ejs");
      }
      else
      {
      let key=await getAPI();
      url+=`&apiKey=${key}`;

      console.log(url);
      const result = await axios.get(url);
      res.render("live.ejs", { array: (result.data.articles) });
      }
      //console.log((result.data.articles));
    } catch (error) {
      //res.render("index.ejs", { content: JSON.stringify(error.response.data) });
      console.log(error);
    }
    //console.log(country);
  });


  app.get("/all", async (req, res) => {
    //const searchId = req.body.id;
    try {
      //console.log(req.body);
      
      res.render("all.ejs");
      //console.log((result.data.articles));
    } catch (error) {
      //res.render("index.ejs", { content: JSON.stringify(error.response.data) });
      console.log(error);
    }
  });

  app.get("/auth/all", async (req, res) => {
    //const searchId = req.body.id;
    
    try {
      if(req.isAuthenticated())
      {
      //console.log(req.body);
      
      res.render("allauth.ejs");
      }
      else{
        res.redirect("/loginsignup");
      }
      //console.log((result.data.articles));
    } catch (error) {
      //res.render("index.ejs", { content: JSON.stringify(error.response.data) });
      console.log(error);
    }
  
  });


  app.post("/all" ,async (req,res)=>{
    console.log(req.body);

    try {
      let url=`${API_URL_all}?pageSize=100`;
      
      
      if ((req.body.searchQuery!=='')&&(req.body.searchQuery!==undefined)) {
        url+=`&q=${req.body.searchQuery}`;
      }
      if (req.body.language!==undefined) {
        url+=`&language=${req.body.language}`;
      }
      if (req.body.sort!==undefined) {
        url+=`&sortBy=${req.body.sort}`;
      }
      let key=await getAPI();
      url+=`&apiKey=${key}`;

      console.log(url);
      const result = await axios.get(url);
      res.render("all.ejs", { array: (result.data.articles) });
      //console.log((result.data.articles));
    } catch (error) {
      //res.render("index.ejs", { content: JSON.stringify(error.response.data) });
      console.log(error);
    }
    //console.log(country);
  });

  app.post("/auth/all" ,async (req,res)=>{
    console.log(req.body);
    if(req.isAuthenticated)
    {
    try {
      let url=`${API_URL_all}?pageSize=100`;
      
      
      if ((req.body.searchQuery!=='')&&(req.body.searchQuery!==undefined)) {
        url+=`&q=${req.body.searchQuery}`;
      }
      if (req.body.language!==undefined) {
        url+=`&language=${req.body.language}`;
      }
      if (req.body.sort!==undefined) {
        url+=`&sortBy=${req.body.sort}`;
      }
       
      let key=await getAPI();
      url+=`&apiKey=${key}`;

      console.log(url);
      //insert url in db or replace if already exists.
      try {
        
         await db.query(
          "UPDATE users_news_aggregator SET url=$1 WHERE email=$2",
          [url,req.user.email]
        );
    } catch (error) {
      console.log(error);
    }
      const result = await axios.get(url);
      res.render("user.ejs", { array: (result.data.articles),user:req.user.email });
      //console.log((result.data.articles));
    } catch (error) {
      //res.render("index.ejs", { content: JSON.stringify(error.response.data) });
      console.log(error);
    }
  }
  else{
    res.redirect("/loginsignup");
  }
    //console.log(country);
  });



  app.get("/auth",(req,res)=>{
    try {
        res.render("loginsignup.ejs");
    } catch (error) {
      console.log(error);
    }
  })


  app.get("/bookmark/delete/:id", async (req,res)=>{
    const id = parseInt(req.params.id);
        try {
            if (req.isAuthenticated()) {
                await db.query("DELETE FROM bookmarks_news_aggregator WHERE id=$1 ;", [id]);
                res.redirect("/bookmark");
            }
            else{
                res.redirect("/loginsignup");
            }
          
      
      
        } catch (error) {
          console.log(error);
          res.status(500).json({ message: "Error deleting record" });
        }
    });

  app.post(
    "/login",
    passport.authenticate("local", {
      successRedirect: "/user",
      failureRedirect: "/login",
      failureMessage:true,
    }),
    //passport.authenticate('local', { failureFlash: 'Invalid username or password.' })
  );

  app.post("/signup", async (req, res) => {
    const email = req.body.username;
    const password = req.body.password;
    try {
      const checkResult = await db.query("SELECT * FROM users_news_aggregator WHERE email = $1", [
        email,
      ]);
  
      if (checkResult.rows.length > 0) {
  
        res.render("login.ejs",{ message: "User already exists. Please LogIn." });
      } else {
        
          bcrypt.hash(password, saltRounds, async (err, hash) => {
            if (err) {
              console.error("Error hashing password:", err);
            } else {
              const result = await db.query(
                "INSERT INTO users_news_aggregator (email , password) VALUES ($1, $2) RETURNING *",
                [email,hash]
              );
              const user = result.rows[0];
              console.log("here",user);
              req.login(user, (err) => {
                if(err)
                {
                  console.log(err);
                }
                console.log("success");
                res.redirect("/auth/Home");
              });
            }
          });
        }
      } catch (err) {
        console.log(err);
      }
    });

  

  passport.use(
    "local",
    new Strategy(async function verify(username, password, cb) {
      try {
        console.log("here");
        const result = await db.query("SELECT * FROM users_news_aggregator WHERE email = $1 ", [
          username,
        ]);
        if (result.rows.length > 0) {
          const user = result.rows[0];
        //   console.log("in login stragey",user,username,password);
          const storedHashedPassword = user.password;
          bcrypt.compare(password, storedHashedPassword, (err, valid) => {
            if (err) {
              console.error("Error comparing passwords:", err);
              return cb(err);
            } else {
              if (valid) {
                
                return cb(null, user);
              } else {
                console.log("here");
                return cb(null, false,{ message: 'Incorrect username or password.' });
              }
            }
          });
        } else {
            console.log("here");
          return cb(null,false,{ message: 'Incorrect username or password.' });
        }
      } catch (err) {
        console.log(err);
      }
    })
  );
  
  passport.serializeUser((user, cb) => {
    cb(null, user);
  });
  
  passport.deserializeUser((user, cb) => {
    cb(null, user);
  });

app.listen(port,()=>{
    console.log(`server listening at port ${port}`);
})
//module.exports=app;
export default app;