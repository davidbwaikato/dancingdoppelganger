import { pointMatches, getMatches } from './point.js'
import Loader from './loader.js';
import { findSkeletonElement, calibrate, scaleAndShift } from './calibrate.js'
import Recorder from './recorder.js';

export default class Draw {
    poses = [];
    goodPoints = [];
    ctx;
    canvas;
    poses;
    video;
    targetPose;
    time = 0;
    score = 0;
    score_history = [ 0 ];
    hasDonePose = false;
    absShoulderPair = undefined;
    calibratedFlag = false;
    recorder;
    danceMoves = [];
    danceMovesIndex = -1;

    positive_col = "hsl(138, 29%, 69%)";  // previously "green"
    average_col  = "hsl( 46, 74%, 40%)";  // previously "orange";
    negative_col = "hsl(  0, 61%, 54%)";  // previously "red"

    posenet_col   = "hsla(0, 61%, 54%, 0.2)"; // used to be red
    
    // https://www.schemecolor.com/real-skin-tones-color-palette.php
    skintone_col = "#8D5524";
    joint_col    = "#E0AC69";
    bone_col     = "#FFDBAC";
    
    calibrate_setup_time_secs     = 5; 
    countdown_update_interval_msecs = 100; 
    countdown_msec_cap              = 1000 - this.countdown_update_interval_msecs;
    
    constructor(ctx, canvas, video) {
        this.ctx = ctx;
        this.canvas = canvas;
        this.video = video;
        this.poses = [];
        this.goodPoints = [];

        this.recorder = new Recorder();
        this.loader = new Loader();

        this.loadCameraAndStartSetup();
        this.setupRecordButtonEventListener();
        this.setUpFileUploadEventListener();
    }

    restartSong() {
        setInterval(this.updateCountdown.bind(this), this.countdown_update_interval_msecs);
        document.querySelector("audio").currentTime = 0;
        document.querySelector("audio").play();
    }

    stopSong() {
        this.danceMoves = [];
        document.querySelector("audio").pause();
    }

    setUpFileUploadEventListener() {
        if (window.location.pathname.endsWith("/game.html")) {
            document.querySelector("#dancingQueen").addEventListener("click", async (e) => {
                this.setDanceMoves(await this.loader.loadPrerecorded());
            })
        } else if (window.location.pathname.endsWith("/created_game.html")) {
            document.querySelector("#fileUpload").addEventListener("change", async (e) => {
                this.setDanceMoves(await this.loader.getFileContents(e));
            });
        }
    }

    setDanceMoves(jsonString) {
        console.log(jsonString);
        this.danceMoves = JSON.parse(jsonString);
        this.nextDanceMove();
        this.calibrateAfterSeconds(this.calibrate_setup_time_secs);
    }

    calibrateAfterSeconds(seconds) {
	let statusElem = document.getElementById('status');
	statusElem.innerText = "Status: Starting calibration process";

        setTimeout(this.checkIfCalibrationNeeded.bind(this), seconds * 1000);	
        setTimeout(this.restartSong.bind(this), seconds * 1000);
    }

    setupRecordButtonEventListener() {
        if (!window.location.pathname.endsWith("/record_dance.html")) return;
        document.querySelector("#record").addEventListener("click", () => {
            if (this.recorder.recording) {
                this.recorder.stopRecording();
                this.stopSong();
            } else {
                this.recorder.startRecording();
                this.calibrateAfterSeconds(this.calibrate_setup_time_secs);
                document.querySelector("#record").textContent = "Stop Recording";
            }
        })
    }

    drawKeyPoints() {
        this.poses.forEach((pose) => {
            pose = pose.pose;
            for (let j = 5; j < 13; j++) {
                const keyPoint = pose.keypoints[j];
                if (keyPoint.score > 0.2) {
                    if (pose.target) {
			// Target pose to strike
                        this.ctx.fillStyle = this.joint_col; 
                        this.drawCircle(keyPoint.position.x, keyPoint.position.y, 7.5);
                    } else {
			// Live position from PoseNet
                        this.ctx.fillStyle = this.posenet_col;
			this.drawCircle(keyPoint.position.x, keyPoint.position.y, 7.5);
                        this.goodPoints[j] = keyPoint;
                    }

                }
            }
        })
    }

    drawCircle(x, y, r) {
        this.ctx.beginPath();
        this.ctx.ellipse(x, y, r, r, Math.PI * 2, 0, Math.PI * 2);
        this.ctx.closePath();
        this.ctx.fill();
    }

    drawBodyPartEllipse(x1, y1, x2, y2, minor_r) {

	const x_diff = x2 - x1;
	const y_diff = y2 - y1;
	
	const line_len = Math.sqrt(x_diff*x_diff + y_diff*y_diff);

	const xm = (x1 + x2) / 2.0;
	const ym = (y1 + y2) / 2.0;

	const major_r = line_len / 2.0;

	const rot_angle = Math.atan2(y_diff,x_diff);
	
        this.ctx.beginPath();
        this.ctx.ellipse(xm, ym, major_r, minor_r, rot_angle, 0, Math.PI * 2);
        this.ctx.closePath();
        this.ctx.fill();
    }

    // A function to draw the skeletons
    drawSkeleton() {
        // Loop through all the skeletons detected
        for (let i = 0; i < this.poses.length; i++) {
            const skeleton = this.poses[i].skeleton;

            // For every skeleton, loop through all body connections
            for (let j = 0; j < skeleton.length; j++) {
                const partA = skeleton[j][0];
                const partB = skeleton[j][1];

                if (this.poses[i].pose.target) {
                    this.ctx.strokeStyle = this.bone_col;
                    this.ctx.fillStyle   = this.skintone_col;

		    const x1 = partA.position.x;
		    const y1 = partA.position.y;
		    
		    const x2 = partB.position.x;
		    const y2 = partB.position.y;

		    this.drawBodyPartEllipse(x1, y1, x2, y2, 10.0);
		    
                    this.ctx.beginPath();
                    this.ctx.moveTo(x1,y1)
                    this.ctx.lineTo(x2,y2);
                    this.ctx.closePath();
                    this.ctx.stroke();
		    
		}
		else {
		    this.ctx.strokeStyle = "hsla(0, 61%, 54%, 0.2)"; // used to be red
                    this.ctx.beginPath();
                    this.ctx.moveTo(partA.position.x, partA.position.y)
                    this.ctx.lineTo(partB.position.x, partB.position.y);
                    this.ctx.closePath();
                    this.ctx.stroke();		    
		}
            }
        }
    }

    draw() {
        this.ctx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);
        if (this.targetPose) this.poses.push(this.targetPose);

        this.drawKeyPoints();
        this.drawSkeleton();

        let matches = getMatches(this.targetPose, this.goodPoints);
        this.awardPoints(matches);

        this.recorder.setCurrentPoses(this.poses);

        // Call draw recursively every frame (max 60fps)
        requestAnimationFrame(this.draw.bind(this));
    }

    updateScore() {
        document.querySelector("#score").innerHTML = "Score: " + this.score;
    }

    awardPoints(matches) {
        if (this.time == 9) {

            let amountToIncreaseScoreBy = 0;

            amountToIncreaseScoreBy = matches - 4;

            if (!this.hasDonePose) {
		let statusElem = document.getElementById('status');
                if (amountToIncreaseScoreBy > 0){
                    statusElem.style.backgroundColor = this.positive_col;
		    statusElem.innerText = this.randomChoiceMessage(this.good_move_message);
                }
                else if (amountToIncreaseScoreBy < 0){
                    statusElem.style.backgroundColor = this.negative_col;		    
		    statusElem.innerText = this.randomChoiceMessage(this.bad_move_message);
                }
                else {
                    statusElem.style.backgroundColor = this.average_col;
		    statusElem.innerText = "Pretty average";
                }

		
                this.hasDonePose = true;
                this.score += amountToIncreaseScoreBy;
		this.score_history.push(amountToIncreaseScoreBy);

		// Work out if bonus-boost, currently used a window of the last 2 vals
		if (this.score_history.length>=3) {

		    const history_len = this.score_history.length;
		    const window_start_pos = history_len -1;
		    const window_end_pos = window_start_pos -1; // window size in effect 2

		    let all_positive = true;
		    let bonus_pos = window_start_pos;

		    while (bonus_pos >= window_end_pos) {
			const past_score = this.score_history[bonus_pos];
			if (past_score<=0) {
			    all_positive = false;
			    break;
			}
			bonus_pos--;
		    }

		    if (all_positive) {
			statusElem.innerText += "\n!!!!BONUS BOOST!!!!";
			this.score += amountToIncreaseScoreBy;
		    }

		    this.updateScore();

		}

            }
        }
    }

    setNewTargetPose(targetPose) {
        this.targetPose = targetPose;
        this.targetPose.pose.target = true;
        this.hasDonePose = false;
    }

    reportLoadError(message) {
        console.log(message);
    }

    updateCountdown() {
        if (!window.location.pathname.endsWith("/game.html") && !window.location.pathname.endsWith("/created_game.html")) return;
	
        const countdownEl = document.querySelector('#countdown');

	const mseconds = (this.time * this.countdown_update_interval_msecs) % (60 * this.countdown_update_interval_msecs);	
	const countdown_mseconds = this.countdown_msec_cap - mseconds;
	
	const countdown_seconds = countdown_mseconds / 1000.0;	
	let countdown_seconds_1dp = Math.round(countdown_seconds * 10) / 10;

	if (countdown_seconds_1dp == 0) {
	    countdown_seconds_1dp = "0.0";
	}
	
        countdownEl.innerHTML = `Seconds until next pose: ${countdown_seconds_1dp}`;
        this.time++;

        if (this.time == 10) {
            // this.loadTargetPose();
            if (this.danceMoves.length != 0) {
                this.nextDanceMove();
            }
            this.time = 0;
        }
    }

    nextDanceMove() {
        if (this.danceMovesIndex < this.danceMoves.length - 1) {
            this.danceMovesIndex++;
        } else {
            this.danceMovesIndex = 0;
	    let statusElem = document.getElementById('status');
	    statusElem.style.backgroundColor = "#5FA6B7";
	    statusElem.innerText = "";
	    
            let message = "\r\n Noice! :-)";
            if (this.score < 0) {
                message = "\r\n Room for improvement :-(";
            }
            alert("Final score: " + this.score + message);
            this.stopSong();
            //Force refresh the page (not using cache)
            document.location.reload(true);
        }
        if (!this.danceMoves[this.danceMovesIndex].poses[0]) return;
        this.setNewTargetPose(this.danceMoves[this.danceMovesIndex].poses[0])
    }

    loadTargetPose() {
        this.loader.loadTargetPose().then(this.setNewTargetPose.bind(this)).catch(this.reportLoadError.bind(this));
    }

    loadCameraAndStartSetup() {
        this.loadCamera().then(this.setup.bind(this)).catch(this.reportLoadError.bind(this));
    }

    setup() {
        this.canvas.width = this.video.videoWidth;
        this.canvas.height = this.video.videoHeight;
        this.video.width = this.video.videoWidth;
        this.video.height = this.video.videoHeight;

        // Create a new poseNet method with a single detection
        let poseNet = ml5.poseNet(this.video, () => {
            console.log("Model Loaded");
        });

        poseNet.on("pose", this.setPoses.bind(this));

        this.draw();
    }

    setPoses(results) {
        this.poses = results;
    }

    loadCamera() {
        return new Promise((resolve, reject) => {
            navigator.mediaDevices.getUserMedia({ audio: false, video: true }).then((stream) => {
                this.video.srcObject = stream;
                this.video.hidden = true;

                // Once the video has loaded that stream, start the main setup
                this.video.addEventListener("loadeddata", () => {
                    resolve();
                });

            }).catch((error) => {
                reject('navigator.MediaDevices.getUserMedia error: ' + error.message + error.name);
            });
        });
    }

    checkIfCalibrationNeeded() {
        if (this.poses[0] != undefined) {
            if (this.calibratedFlag == false) {
                //console.log("calibratedFlag was false." + calibratedFlag);
                //Find the element which has the pair of shoulders from the first pose in the poses array
                let shouldersIndex = findSkeletonElement("rightShoulder", "leftShoulder", this.poses[0].skeleton);

                //If the shoulders were found
                if (shouldersIndex > -1) {
                    //Scale and shift targetPose to the first pose in the poses array
                    //targetPose = scaleAndShift(targetPose, poses[0].skeleton[shouldersIndex]);
                    calibrate(this.targetPose, this.poses[0].skeleton[shouldersIndex]);
                }
            }
            else {
                //Shift it to it's point relative to absoluteShoulderPair
                scaleAndShift(this.targetPose, this.absShoulderPair);

                //Yoink some stuff outta matchPose
                // Compare only main body sections
                let matches = getMatches(this.targetPose, this.goodPoints);
                //If they're close to getting the pose
                if (matches > 4) {
                    //Find the element which has the pair of shoulders from the first pose in the poses array
                    let shouldersIndex = findSkeletonElement("rightShoulder", "leftShoulder", this.poses[0].skeleton);

                    //If the shoulders were found
                    if (shouldersIndex > -1) {
                        //Shift this pose closer to them (don't change absShoulderPair)
                        scaleAndShift(this.targetPose, this.poses[0].skeleton[shouldersIndex]);
                    }
                }
                //else {
                //Shift it to it's point relative to absoluteShoulderPair
                //    scaleAndShift(targetPose, absShoulderPair);
                //}
            }
        }

	let statusElem = document.getElementById('status');
	statusElem.innerText = "Status: calibration process completed";

	
    }

    // http://blog.writeathome.com/index.php/2014/01/100-ways-to-say-great/
    
    good_move_message = [
	"Great Move!",
	"Admirable!", "Amazing!",  "Arresting!",  "Astonishing!",  "Astounding!",  "Awesome!",  "Awe-inspiring!",  "Beautiful!",
	"Breathtaking!",  "Brilliant!",  "Capital!",  "Captivating!",  "Clever!",  "Commendable!",
	"Delightful!",  "Distinguished!",  "Distinctive!",
	"Engaging!",  "Enjoyable!",  "Estimable!",  "Excellent!",  "Exceptional!",  "Exemplary!",  "Exquisite!",  "Extraordinary!",
	"Fabulous!",  "antastic!",  "Fascinating!",  "Finest!",  "First-rate!",  "Flawless!",  "Four-star!",
	"Glorious!",  "Grand!",  "Impressive!",  "Incomparable!",  "Incredible!",  "Inestimable!",  "Invaluable!",
	"Laudable!",  "Lovely!",
	"Magnificent!",  "Marvelous!",  "Masterful!",  "Mind-blowing!",  "Mind-boggling!",  "Miraculous!",  "Monumental!",
	"Notable!",  "Out of sight!",  "Out of this world!",  "Outstanding!",  "Overwhelming!",
	"Peerless!",  "Perfect!",  "Phenomenal!",  "Praiseworthy!",  "Priceless!",
	"Rapturous!",  "Rare!",  "Refreshing!",  "Remarkable!",
	"Sensational!",  "Singular!",  "Skillful!",  "Smashing!",  "Solid!",  "Special!",  "Spectacular!",  "Splendid!",
	"Splendiferous!",  "Splendorous!",  "Staggering!",  "Sterling!",  "Striking!",  "Stunning!",  "Stupendous!",
	"Super!",  "Superb!",  "Super-duper!",  "Superior!",  "Superlative!",  "Supreme!",  "Surprising!",
	"Terrific!",  "Thumbs up!",  "Thrilling!",  "Tiptop!",  "Top-notch!",  "Transcendent!",  "Tremendous!",
	"Unbelievable!",  "Uncommon!",  "Unique!",  "Unparalleled!",  "Unprecedented!",
	"Wonderful!",  "Wondrous!",  "World-class!"
    ];


    bad_move_message = [ "Ouch!!", "Mmmmm!", "Haven't seen that before!", "Brave choice of move!" ];

    // "Terrible", "Awful", "Rubbish", "Disgraceful", "Garbage", "Drivel" ];

    randomChoiceMessage(array) {
	let choice = array[Math.floor(Math.random() * array.length)];

	return choice;
    }
	
}
