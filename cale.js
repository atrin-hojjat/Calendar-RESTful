const express = require("express");
const router = express();
const jwt = require("jsonwebtoken");
//const sjcl = require("sjcl");
const { Pool } = require("pg");
const config = require('./config.json');
const { validateToken } = require('./users.js');

const pool = new Pool();

var secret = process.env.SECRET;

router.use(async (req, res, next) => {
  let tok = await validateToken(req);
  if(!tok.auth) return res.status(403).send({message: "Your Token has expired, Please login again"});
  req.tok = tok;
  next()
});

router.get("/calendars", async (req, res) => {
  let tok = req.tok;
  let cs = await pool
    .query("select calendars.name, calendars.name, calendar.id, roles.name, roles.id, user_roles.username"
      + "from calendars inner join user_roles on calendars.id = user_roles.calendar"
      + "inner join roles on user_roles.role=roles.id where user_roles.username=$1 and roles.see",
      [tok.val.id])
    .then(res => {
      return res.rows;
    })
    .catch(err => {
      console.error(err.stack);
      return null;
    });
  return res.status(200).send({calendars: cs});
});

router.get("/calendars/all", async (req, res) => {
  let cs = await pool
    .query("select name from calendars")
    .then(res => return res)
    .catch(err => {
      console.error(err.stack);
      return null;});
  return res.status(200).send({calendars: cs});
});

//Base functinos
var get_calendar_by_role = async (role) => {
    return await pool
      .query("select cname from roles where id=$1", [role])
      .then(res => {if(res.rows.length) return res.rows[0].cname else return null})
      .catch(err => throw err);

};

var get_role_by_user_and_calendar = async (user, calendar) => {
  return await pool
    .query("select role from user_roles where calendar=$1 and username=$2", [calendar, user])
    .then(res => {if(res.rows.length) return res.rows[0].role else return null})
    .catch(err => throw err);
};

var check_authority_by_username_and_calendar = async (user, calendar, task) => {
  return await check_authority(await get_role_by_user_and_calendar(user, calendar), task);
};

var check_authority = async (role, task) => {
  if(role == null) return null;;
  return await pool
    .query("select " + task + " from roles where id=$1", [role])
    .then(res => return res.rows[0]);
    .catch(err => throw err);
};


//Calendar Basics
router.post("/calendar", /*async*/ (req, res) => {
  let tok = req.tok;
  try {
    let cal_id = await pool
      .query("insert into calendars (cname) values ($1)returning id", [req.body.calendar_name]);
    let ad_id = await pool
      .query("insert into roles (name, cname, edit_calendar, edit_tast, edit_roles, edit_users, comment, see)"
        + "values ('Admin', $1, true, true, true, true, true, true) returning id", [cal_id]);
    await pool.query("insert int user_roles (username, calendar, role) values ($1, $2, $3)", [tok.val.id, cal_id, ad_id]);
  } catch (err) {
    console.log(err.stack);
    return res.status(500).send({message: 
      "Internal server error while reaching database, please try again, contact admin if problem was not fixed"}); 
  }
});

router.get("/calendar", async (req, res) => {
  let tok = req.tok;
  //???
});

router.put("/calendar", async (req, res) => {
  let tok = req.tok;
  try {
    let auth = check_authority_by_username_and_calendar(tok.val.id, req.headers.calendar, "edit_calendar");
    if(auth === null)
      return res.status(404).send({message: "data not found"})
    let can_edit = auth.edit_calendar;
    if(can_edit === false) 
      return res.status(403).send({message: "You are not authorized to edit roles in this calendar"});
    await pool
      .query("update calendars set cname=$2 where id=$1", [req.headers.calendar, req.headers.new_name]);
    return res.status(200).send({message: "Calendar successfully updated"});
  } catch(err) {
    console.log(err.stack);
    return res.status(500).send({message: 
      "Internal server error while reaching database, please try again, contact admin if problem was not fixed"}); 
  }
  
});

router.delete("/calendar", async (req, res) => {
  let tok = req.tok;
  try {
    let auth = check_authority_by_username_and_calendar(tok.val.id, req.headers.calendar, "edit_calendar");
    if(auth === null)
      return res.status(404).send({message: "data not found"})
    let can_edit = auth.edit_calendar;
    if(can_edit === false) 
      return res.status(403).send({message: "You are not authorized to edit roles in this calendar"});
    await pool
      .query("delete from calendars where id=$1", [req.headers.calendar]);
    await pool
      .query("delete from roles where cname=$1", [req.headers.calendar]);
    await pool
      .query("delete from user_roles where calendar=$1", [req.headers.calendar]);
    await pool
      .query("delete from tasks where cname=$1", [req.headeres.calendar]);
    return res.status(200).send({message: "Calendar successfully deleted"});
  } catch (err) {
    console.log(err.stack);
    return res.status(500).send({message: 
      "Internal server error while reaching database, please try again, contact admin if problem was not fixed"}); 
  }
});


//Task Basics
router.post("/task", async (req, res) => {
});

router.put("/task", async (req, res) => {
});

router.get("/task", async (req, res) => {
});

router.delete("/task", async (req, res) => {
});

//Roles

var check_role_edit_access = async (req, res, next) => {
  let tok = req.tok;
  try {
    let auth = check_authority_by_username_and_calendar(tok.val.id, req.headers.calendar, "edit_roles");
    if(auth === null)
      return res.status(404).send({message: "data not found"})
    let can_edit = auth.edit_roles;
    if(can_edit === false) 
      return res.status(403).send({message: "You are not authorized to edit roles in this calendar"});
    next();
  } catch(err) {
    console.error(err.stack);
    return res.status(500).send({message: "Internal server error"});
  }
};

router.use("/roles/", check_role_edit_access);
router.use("/role/", check_role_edit_access);
router.use("/merge_roles/", check_role_edit_access);

router.get("/roles/:calendar/", async (req, res) => {
  return await pool
    .query("select * from roles where cname=$1", [req.params.calendar])
    .then(resp => {
      return res.status(200).send({values: req.rows});
    })
    .catch(err => {
      console.error(err.stack);
      return res.status(500).send({message: "Internal sever error"});
    });
});

router.post("/role/:calendar", async (req, res) => {
  let tok = req.tok;
  try {
    let role = await pool
      .query("insert into roles(name, cname, edit_task, edit_roles, edit_users, comment, see, edit_calendar "
        + "values($1, $2, $3, $4, $5, $6, $7, $8) returning name, id", [req.body.role_name, req.params.calendar, 
          req.body.edit_task, req.body.edit_roles, req.bdoy.edit_users, req.body.comment, req.body.see, req.body.edit_calendar]);
    return res.status(200).send({message: "Role successfully updated"}, role: role);
  } catch (err) {
    console.error(err.stack);
    return res.status(500).send({message: "Internal server error, try again later"});
  }
});

router.put("/role/:calendar/", async (req, res) => {
  let tok = req.tok;
  try {
    await pool
      .query("update roles set name=$1, edit_task=$2, edit_roles=$3, edit_users=$4, comment=$5, see=$6, edit_calendar=$7"
        + " where id=$8", [req.body.role_name, req.body.edit_task, req.body.edit_roles, 
          req.bdoy.edit_users, req.body.comment, req.body.see, req.body.edit_calendar, req.body.role_id]);
    return res.status(200).send({message: "Role successfully updated"});
  } catch (err) {
    console.error(err.stack);
    return res.status(500).send({message: "Internal server error, try again later"});
  }

});

router.get("/my_role/:calendar", async (req, res) => {
  let tok = req.tok;
  try {
    let role = get_role_by_user_and_calendar(tok.values.id, req.params.calendar);
    if(role === null) return res.status(404).send({message: "data not found"});
    let rl = pool
      .query("select * from roles where id=$1", [role])
      .then(res => {return res.rows[0];})
      .catch(err => {throw err});
    return res.status(200).send({val: rl});
  } catch(err) {
    console.error(err.stack);
    return res.status(500).send({message: "Internal server error"});
  }
});

router.get("/role/:calendar/", async (req, res) => {
  let tok = req.tok;
  try {
    let rl = pool
      .query("select * from roles where id=$1", [req.body.role])
      .then(res => {if(res.rows.length) return res.rows[0]; else return null;})
      .catch(err => {throw err});
    return res.status(200).send({val: rl});
  } catch(err) {
    console.error(err.stack);
    return res.status(500).send({message: "Internal server error"});
  }
});

router.get("/merge_role/:calendar", async (req, res) => {
  //TODO
});

router.delete("/role/:calendar/", async (req, res) => {
  let tok = req.tok;
  try {
    await pool
      .query("delete from roles where id=$1", [req.headers.role]);
    await pool
      .query("delete from user_roles where role=$1", [req.headers.role]);
    return res.status(200).send({message: "Role successfully deleted"});
  } catch(err) {
    console.log(err.stack);
    return res.status(500).send({message: 
      "Internal server error while reaching database, please try again, contact admin if problem was not fixed"}); 
  }
});

//Users
router.get("/users/:calendar/", async (req, res) => {

});

router.post("/user/:calendar/:user", async (req, res) => {
});

router.put("/user/:calendar/:user", async (req, res) => {
});

router.delete("/user/:calendar/:user", async (req, res) => {
});



module.exports = {router: router};
