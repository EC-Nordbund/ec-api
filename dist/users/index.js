"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const authKey_1 = require("./authKey");
const user_1 = require("./user");
const userGroup_1 = require("./userGroup");
const mail_1 = require("../schema/mail");
const mysql_1 = require("../schema/mysql");
const js_sha3_1 = require("js-sha3");
function hash(pwd, salt) {
    return js_sha3_1.sha3_512(salt + pwd);
}
function login(username, password) {
    const tmpDate = new Date();
    const getUsers = exports.users
        .filter(v => v.userName === username)
        .filter(user => {
        return tmpDate <= new Date(user.ablaufDatum);
    });
    if (getUsers.length !== 1) {
        throw 'Username und Password passen nicht zusammen';
    }
    else {
        let ckUser = getUsers[0];
        let h = hash(password, ckUser.salt);
        if (h === ckUser.pwdHash) {
            let authToken = new authKey_1.authKey(ckUser);
            exports.authKeys.push(authToken);
            return authToken.authToken;
        }
        else {
            throw 'Username und Password passen nicht zusammen';
        }
    }
}
exports.login = login;
function logout(authToken) {
    exports.authKeys = exports.authKeys.filter(v => v.authToken !== authToken);
    return true;
}
exports.logout = logout;
function extend(authToken) {
    const tmpDate = new Date();
    let keys = exports.authKeys
        .filter(v => v.authToken === authToken)
        .filter(v => {
        return v.ablaufTime > tmpDate;
    });
    if (keys.length !== 1) {
        return false;
    }
    else {
        keys[0].extend();
        return true;
    }
}
exports.extend = extend;
function getUser(authToken) {
    const tmpDate = new Date();
    const auth = exports.authKeys
        .filter(v => v.authToken === authToken)
        .filter(v => {
        return v.ablaufTime > tmpDate;
    })[0];
    if (auth === undefined) {
        throw 'User not Found';
    }
    auth.extend();
    return auth.user;
}
exports.getUser = getUser;
function userReactivation(authToken, pin) {
    const auth = exports.authKeys
        .filter(v => v.authToken === authToken)[0];
    if (auth === undefined) {
        throw 'User not Found';
    }
    auth.reactivate(pin);
    return auth.user;
}
exports.userReactivation = userReactivation;
exports.users = [];
exports.userGroups = [];
exports.authKeys = [];
async function load() {
let a = await mysql_1.query(`SELECT * FROM save`).then(res => res[0].save)
    let saveObj = JSON.parse(a);
console.log(saveObj)
    saveObj.userGroups.map(JSON.parse).forEach(v => {
        exports.userGroups.push(new userGroup_1.userGroup(v.userGroupID, v.bezeichnung, v.mutationRechte, v.fieldAccess));
    });
    saveObj.users.map(JSON.parse).forEach(v => {
        exports.users.push(new user_1.user(v.userID, v.personID, v.userName, v.pwdHash, v.salt, v.ablaufDatum, v.userGroupID, v.pin));
    });
}
async function save() {
    const saveObj = {
        users: exports.users.map(user => user.toSave()),
        userGroups: exports.userGroups.map(group => group.toSave()),
    };
    mysql_1.query(`UPDATE save SET save = '${JSON.stringify(saveObj).split('\\').join('\\\\\\')}'`);
    const saveObj2 = {
        users: exports.users.map(user => JSON.parse(user.toSave(true))),
        userGroups: exports.userGroups.map(group => group.toSave()),
    };
    // Logge status to DB
    mysql_1.query(`INSERT INTO userLogging (JSON) VALUES ('${JSON.stringify(saveObj2)}');`).catch(console.log);
}
(async () => {
    await load();
    await save();
})();
setInterval(save, 60 * 60 * 1000);
function deleteUser(userID) {
    exports.users = exports.users.filter(v => v.userID !== userID);
    save();
}
exports.deleteUser = deleteUser;
function addUser(personID, username, email, gueltigBis, userGroupID) {
    const pwd = js_sha3_1.sha3_512(`${username}jkfhhksjdfhjkdfjk${Math.random()}${new Date().toISOString()}`).substr(1, 10);
    const salt = js_sha3_1.sha3_512(`${username}${pwd}clkkk${Math.random()}${new Date().toISOString()}`);
    const pwdHash = hash(pwd, salt);
    let nID = -1;
    exports.users.forEach(v => {
        if (nID < v.userID) {
            nID = v.userID;
        }
    });
    nID++;
    exports.users.push(new user_1.user(nID, personID, username, pwdHash, salt, gueltigBis, userGroupID, undefined));
    save();
    const subject = 'Anmeldedaten für den EC-Nordbund';
    const to = email;
    const body = `Moin,

Vielen Dank für deinen Einsatz im EC-Nordbund. Du erhälst in dieser E-Mail alle Informationen zu deinem Zugang zu unserer Software dazu folge bitte den folgenden Schritten:

1. Lade dir von https://github.com/ecnordbund/ec-verwaltungs-app/releases die Software runter. Nutze dabei die aktuellste Version bei dem nicht "Pre-release" steht. Wähle die richtige Datei je nach Betriebsystem aus (.exe für windows, .dmg für MacOS, .deb für Linux)
2. Installiere das Programm. Dazu musst du evtl. deinen Virenscanner auschalten. Je nach Virenscanner kann es passieren, dass er die Installation blockt, da diese nicht Zertifiziert / unsicher sei.
3. Das Programm startet automatisch. Du solltest automatisch eine Desktop-Verknüpfung sowie einen eintrag im Startmenü erhalten, mit dem du die Software später erneut starten kannst.
4. Melde dich mit deinen Anmeldedaten an. Diese sind Benutzename: "${username}", Passwort: "${pwd}".
5. Eine Meldung sollte erscheinen, dass du einer Datenschutzerklärung zustimmen musst. Diese solltest du dir genau durchlesen! Mit dem klick auf "Ich stimme der Datenschutzerklärung zu." stimmst du dieser zu. Sie enthält auch Hinweise wie du mit Daten aus unserer Software umgehen musst!
6. Gehe zu "Profil" und klicke auf "Passwort ändern"
7. Erstelle ein neues Passwort.
8. Schaue dich in dem Programm um. Bei fragen besuche die Hilfe oder schreibe eine E-Mail and app@ec-nordbund.de.

Entschieden für Christus grüßt
Thomas Seeger sowie Tobias Krause und Sebastian Krüger
`;
    return mail_1.default('app@ec-nordbund.de', { to }, subject, body, false);
}
exports.addUser = addUser;
function updateUser(userID, gueltigBis, userGroupID) {
    let u = exports.users.filter(v => v.userID === userID)[0];
    u.ablaufDatum = gueltigBis;
    u.userGroupID = userGroupID;
    save();
}
exports.updateUser = updateUser;
function changePWD(userID, oldPWD, newPWD) {
    let u = exports.users.filter(v => v.userID === userID)[0];
    let oldHash = hash(oldPWD, u.salt);
    if (oldHash === u.pwdHash) {
        const nSalt = js_sha3_1.sha3_512(`${u.pwdHash}${oldPWD}${Math.random()}${new Date().toISOString()}${newPWD}kjsfksjd`);
        const nHsh = hash(newPWD, nSalt);
        u.salt = nSalt;
        u.pwdHash = nHsh;
        return true;
    }
    else {
        return false;
    }
}
exports.changePWD = changePWD;
