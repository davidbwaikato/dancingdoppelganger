export default class Loader {
    loadTargetPose() {
        let danceMoves = ['Y-pose.json', 'T-pose.json', 'rightArmUp.json']
        let randomlyPickDanceMove = danceMoves[Math.floor(Math.random() * danceMoves.length)];
        return new Promise((resolve, reject) => {
            var xobj = new XMLHttpRequest();
            xobj.overrideMimeType("application/json");
            xobj.open('GET', randomlyPickDanceMove, true); // Replace 'appDataServices' with the path to your file
            xobj.onreadystatechange = function () {
                if (xobj.readyState == 4 && xobj.status == "200") {
                    let targetPose = JSON.parse(xobj.responseText);
                    resolve(targetPose);
                }
            };
            xobj.send(null);
        });
    }

    loadPrerecorded() {
        return new Promise((resolve, reject) => {
            var xobj = new XMLHttpRequest();
            xobj.overrideMimeType("application/json");
            xobj.open('GET', "songs/dancing_queens_actual.json", true); // Replace 'appDataServices' with the path to your file
            xobj.onreadystatechange = function () {
                if (xobj.readyState == 4 && xobj.status == "200") {
                    let danceMoves = xobj.responseText;
                    resolve(danceMoves);
                }
            };
            xobj.send(null);
        });
    }

    async readSingleFile(e) {
        var file = e.target.files[0];
        if (!file) {
            return;
        }
        return new Promise((resolve, reject) => {
            var reader = new FileReader();
            reader.onload = async function (e) {
                var contents = e.target.result;
                resolve(contents);
            };
            reader.readAsText(file);
        });
    }

    async getFileContents(e) {
        let contents = await this.readSingleFile(e);
        return contents;
    }
}
