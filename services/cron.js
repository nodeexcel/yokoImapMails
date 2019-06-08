const CronJob = require('cron').CronJob;
const Imap = require('imap')
const MailParser = require("mailparser").simpleParser;
const in_array = require("in_array");
const self = {};
const db = require('../db');
const async = require('async');

let inboxQueue = async.queue(function (task, callback) {
    processInbox(task).then((response) => {
        callback()
    })
});

let sentBoxQueue = async.queue(function (task, callback) {
    processSentBox(task).then((response) => {
        callback()
    })
});

inboxQueue.drain(function () {
    console.log('all inboxQueue items have been processed');
});

sentBoxQueue.drain(function () {
    console.log('all sentBoxQueue items have been processed');
});

let processInbox = (imapData) => {
    return new Promise((resolve, reject) => {
        try {
            self.createImapConnection(imapData).then(async (imap) => {
                imap.once("ready", async function () {
                    self.openImapInbox(imap).then((response) => {
                        var delay = 24 * 3600 * 1000;
                        var yesterday = new Date();
                        yesterday.setTime(Date.now() - delay);
                        yesterday = yesterday.toISOString();
                        imap.search(["ALL"], function (err, results) {
                            var f = imap.fetch(results, {
                                bodies: "",
                                struct: true
                            });

                            f.on("message", function (msg, seqno) {
                                msg.on("body", function (stream) {
                                    MailParser(stream).then(async mail => {
                                        let from = mail.from.value[0].name;
                                        let fromEmail = mail.from.value[0].address;
                                        let query = `insert into inbox (Email, Name) values(?,?);`
                                        let data = [fromEmail, from]
                                        db.runQuery(query, data).then((queryResponse) => {
                                            console.log(queryResponse)
                                        })
                                    })
                                })

                            })

                            f.once("error", function (err) {
                                console.log("Fetch error: " + err);
                            });
                            f.once("end", function () {
                                console.log("Done fetching all messages!");
                                resolve();
                                imap.end();
                            });
                        })
                    })

                })
                imap.once("error", function (err) {
                    console.log(err);
                });
                imap.once("end", function () {
                    console.log("Connection ended");
                });
                imap.connect()
            });
        } catch (err) {
            console.log(err)
        }
    })
}

let processSentBox = (imapData) => {
    return new Promise((resolve, reject) => {
        try {
            self.createImapConnection(imapData).then(async (imap) => {
                imap.once("ready", async function () {
                    self.openImapInbox(imap).then((response) => {
                        var delay = 24 * 3600 * 1000;
                        var yesterday = new Date();
                        yesterday.setTime(Date.now() - delay);
                        yesterday = yesterday.toISOString();
                        imap.search(["ALL"], function (err, results) {
                            var f = imap.fetch(results, {
                                bodies: "",
                                struct: true
                            });

                            f.on("message", function (msg, seqno) {
                                msg.on("body", function (stream) {
                                    MailParser(stream).then(async mail => {
                                        let to = mail.to.value[0].address;
                                        let toName = mail.to.value[0].name;
                                        let query = `insert into inbox (Email, Name) values(?,?);`
                                        let data = [to, toName]
                                        db.runQuery(query, data).then((queryResponse) => {
                                            console.log(queryResponse)
                                        })
                                    })
                                })

                            })

                            f.once("error", function (err) {
                                console.log("Fetch error: " + err);
                            });
                            f.once("end", function () {
                                console.log("Done fetching all messages!");
                                resolve();
                                imap.end();
                            });
                        })
                    })

                })
                imap.once("error", function (err) {
                    console.log(err);
                });
                imap.once("end", function () {
                    console.log("Connection ended");
                });
                imap.connect()
            });
        } catch (err) {
            console.log(err)
        }
    })
}


self['startCronWorkForInbox'] = module.exports.startCronWorkForInbox = async () => {
    // new CronJob('* * * * * *', function () {
    let query = `Select * from imapDetails`;
    db.runQuery(query, []).then((response) => {
        response.forEach(element => {
            inboxQueue.push(element);
            sentBoxQueue.push(element);
        });
    })
    // }, null, true, 'America/Los_Angeles');
}

self['createImapConnection'] = module.exports.createImapConnection = (data) => {
    return new Promise((resolve, reject) => {
        try {
            console.log(data.email, data.password)
            let imap = new Imap({
                user: data.email,
                password: data.password,
                host: process.env.imapHost,
                port: process.env.imapPort,
                tls: true
            })
            resolve(imap)
        } catch (err) {
            console.log(err)
        }
    })
}

self['openImapInbox'] = module.exports.openImapInbox = async (imap) => {
    return new Promise((resolve, reject) => {
        function openInbox(cb) {
            imap.openBox("INBOX", true, cb);
        }

        imap.once("ready", function () {
            openInbox(function (err, box) {
                if (err) {
                    reject(err);
                } else {
                    resolve(box);
                }
            });
        });
        imap.once("error", function (err) {
            console.log(err)
            // reject(err);
        });
        imap.once("end", function () {
            console.log("Connection ended");
        });
        imap.connect();
    })
}

self['openImapSentBox'] = module.exports.openImapSentBox = async (imap) => {
    return new Promise((resolve, reject) => {
        function openInbox(cb) {
            imap.openBox("SENT", true, cb);
        }

        imap.once("ready", function () {
            openInbox(function (err, box) {
                console.log(err, box)
                if (err) {
                    reject(err);
                } else {
                    resolve(box);
                }
            });
        });
        imap.once("error", function (err) {
            console.log(err)
            // reject(err);
        });
        imap.once("end", function () {
            console.log("Connection ended");
        });
        imap.connect();
    })
}
