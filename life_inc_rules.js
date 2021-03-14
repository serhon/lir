/*
*	Life-Including-Rules for Web - 2D cellular automaton, part of which defines its birth/death rules
*	v0.3.0, 2021.03.14
*	Copyright (c) 2021 serhon <serhon@protonmail.com>
*/

// Consts
const lirNameVerStr = "Life-Including-Rules v0.3.0 for Web";
const lirUrlStr = "https://github.com/serhon/lir";

const lirControlsHelpStr = "<i>Controls</i><br><br>\
0: pause to edit<br>\
1&ndash;9: speed<br>\
M: max speed<br>\
N (speed=0): next moment<br>\
L-CLICK (speed=0): edit<br>\
CTRL: protect (freeze)<br>\
SHIFT: edit 5x5 instead of 1x1<br>\
I: invert<br>\
R: reset; G: reset, add 4 gliders";

const lirRulesAreaHelpStr = "<i>Rules Area</i><br><br>\
Left column defines birth rules (dead cell &mdash; active rule) and right column defines death rules (alive cell &mdash; active rule) for 0 (top) to 8 (bottom) alive neighbours.<br>\
Initially it is standard Conway's Life: B3/D0145678.";

const lirRainbowColors = [
	[0x00, 0x00, 0x00],  // black
	[0xD0, 0x00, 0xF0],  // violet
	[0x00, 0x00, 0xD0],  // blue
	[0x00, 0x60, 0xFF],  // light-blue
	[0x00, 0xE0, 0xE0],  // cyan (ILLIGAL ALIEN)
	[0x40, 0xC0, 0x00],  // green
	[0xF0, 0xF0, 0x00],  // yellow
	[0xF0, 0x80, 0x00],  // orange
	[0xF0, 0x00, 0x00]]; // red


// Primary adjustable parameters; can be changed with "LIR" object in HTML that embeds this script
var lirFieldSizeLog = ((typeof LIR !== "undefined") && (typeof LIR.fieldSizeLog === "number")) ? Math.max(6, LIR.fieldSizeLog) : 6;
var lirCellSize = ((typeof LIR !== "undefined") && (typeof LIR.cellSize === "number")) ? LIR.cellSize : 11;
var lirFramerate = ((typeof LIR !== "undefined") && (typeof LIR.framerate === "number")) ? LIR.framerate : 10;
var lirMaxFramerate = ((typeof LIR !== "undefined") && (typeof LIR.maxFramerate === "number")) ? LIR.maxFramerate : 120;
var lirShowGrid = ((typeof LIR !== "undefined") && (typeof LIR.showGrid === "boolean")) ? LIR.showGrid : true;
var lirShowAgecolors = ((typeof LIR !== "undefined") && (typeof LIR.showAgecolors === "boolean")) ? LIR.showAgecolors : false;

var lirControlsWidth = ((typeof LIR !== "undefined") && (typeof LIR.controlsWidth === "number")) ? LIR.controlsWidth : 384;
var lirControlsLeftPadding = ((typeof LIR !== "undefined") && (typeof LIR.controlsLeftPadding === "number")) ? LIR.controlsLeftPadding : 48;

var lirControlsFontSize = ((typeof LIR !== "undefined") && (typeof LIR.controlsFontSize === "number")) ? LIR.controlsFontSize : 20;
var lirHelpFontSize = ((typeof LIR !== "undefined") && (typeof LIR.helpFontSize === "number")) ? LIR.helpFontSize : 18;
var lirCredFontSize = ((typeof LIR !== "undefined") && (typeof LIR.credFontSize === "number")) ? LIR.credFontSize : 12;


// Derived parameters
var lirFieldSize = 1 << lirFieldSizeLog;
var lirFieldSizeMask = lirFieldSize - 1;

var lirCanvasSize = lirCellSize * lirFieldSize;

// Well... palette
var lirPalette = new Array(0x100 + 3); // 0 - black, [1, 0xFF] - rainbow-log-scaled , 0x100 - white, 0x101 - grey, 0x102 - dark grey

// B/D rules. Initially B3/D0145678, standard Life
var lirBirthRules = [false, false, false, true, false, false, false, false, false];
var lirDeathRules = [true, true, false, false, true, true, true, true, true];

// Field data
var lirFieldCurrent;
var lirFieldNext;
var lirFieldProtect;

// Rules-related vars and funcs
var lirRulesAreaX = [new Array(9), new Array(9)], lirRulesAreaY = [new Array(9), new Array(9)];
var lirRulesWriteFunc, lirRulesProtectFunc, lirRulesReadFunc, lirRulesDrawFunc;

var lirPageLoaded = false;

// Sync timer id
var lirSyncTimerID;

var lirTimeSteps = 0;


// Canvas, controls & other markup
var lirHTML = "";

lirHTML += "<div style=\"float: left;\">";
lirHTML += "<canvas id=\"lir_canvas\" width=\"" + lirCanvasSize + "\" height=\"" + lirCanvasSize + "\" style=\"width: " + lirCanvasSize + "px; height: " + lirCanvasSize + "px; box-shadow: 0 0 8px #000000;\"></canvas>"; // there are "native" and "on-page" width & height of canvas... ensuring they're equal
lirHTML += "</div>";

lirHTML +=  "<div style=\"float: left; width: " + lirControlsWidth + "px; padding-left: " + lirControlsLeftPadding + "px;\">";

lirHTML += "<form style=\"font-size: " + lirControlsFontSize + "px;\">";

lirHTML += "<p>Speed: <input type=\"range\" id=\"lirSliderFramerate\" title=\"Generations per second (roughly)\n0 to pause and edit\" min=\"0\" max=\"" + lirMaxFramerate + "\" step=\"1\" value=\"" + lirFramerate + "\" style=\"width: 240px;\" onChange=\"lirFramerateChange()\" /> <label id=\"lirLabelFramerate\">" + lirFramerate + "</label><br>";

lirHTML += "<label for=\"lirRulesArea\">Rules Area:</label> <select id=\"lirRulesArea\" onChange=\"lirRulesAreaChange()\">\
<option value=\"2c9r5x5near\">2 cols 9 rows 5x5 near</option>\
<option value=\"2c9r5x5far\">2 cols 9 rows 5x5 far</option>\
<option value=\"2c9r4x4near\">2 cols 9 rows 4x4 near</option>\
<option value=\"2c9r4x4far\">2 cols 9 rows 4x4 far</option>\
<option value=\"2x9pairsnear\">2 x 9 pairs near</option>\
<option value=\"2x9pairsfar\">2 x 9 pairs far</option>\
<option value=\"rand\">random 2 x 9 4x4</option>\
</select><br>";

lirHTML += "<input type=\"checkbox\" id=\"lirCheckboxGrid\" checked onChange=\"lirGridChange()\" /> <label>Grid</label><br>";

lirHTML += "<input type=\"checkbox\" id=\"lirCheckboxAgecolors\" title=\"Newer (violet) to older (red), log-rainbow palette\" onChange=\"lirAgecolorsChange()\" /> <label>Agecolors</label></p>";

lirHTML += "</form>";

lirHTML += "<hr><p style=\"font-size: " + lirHelpFontSize + "px; margin: 8px auto 0px auto;\">" + lirControlsHelpStr + "</p>";

lirHTML += "<hr><p style=\"font-size: " + lirHelpFontSize + "px; margin: 8px auto 0px auto;\">" + lirRulesAreaHelpStr + "</p>";

lirHTML += "<hr><p style=\"font-size: " + lirCredFontSize + "px; margin: 8px auto 0px auto;\">" + lirNameVerStr + "<br><a href=\"" + lirUrlStr + "\">" + lirUrlStr + "</a></p>";

lirHTML += "</div>";

lirHTML +=  "<div style=\"clear: both; height: 0px;\">&nbsp;</div>";


document.write(lirHTML);

document.close();


var lirCanvas = document.getElementById("lir_canvas");
var lirCanvasContext = lirCanvas.getContext("2d");
var lirCanvasImageData = lirCanvasContext.getImageData(0, 0, lirCanvasSize, lirCanvasSize);
var lirCanvasRawData = lirCanvasImageData.data;


// Handlers for controls

// Framerate changed
function lirFramerateChange() {
	if (lirPageLoaded) {
		lirFramerate = lirSliderFramerate.value;
		lirLabelFramerate.innerHTML = lirFramerate;

		if (lirSyncTimerID >= 0) {
			window.clearInterval(lirSyncTimerID);
			lirSyncTimerID = -1;
		}

		if (lirFramerate > 0) {
			lirSyncTimerID = window.setInterval("lirSyncField()", 1000 / lirFramerate);
		}
	}
}

function lirRulesAreaChange() {
	if (lirPageLoaded) {
		switch (lirRulesArea.value) {
			case "2c9r5x5near":
				lirSetRulesArea2c9r5x5(false);
				break;

			case "2c9r5x5far":
				lirSetRulesArea2c9r5x5(true);
				break;

			case "2c9r4x4near":
				lirSetRulesArea2c9r4x4(false);
				break;

			case "2c9r4x4far":
				lirSetRulesArea2c9r4x4(true);
				break;

			case "2x9pairsnear":
				lirSetRulesArea2x9pairs(false);
				break;

			case "2x9pairsfar":
				lirSetRulesArea2x9pairs(true);
				break;

			case "rand":
				lirSetRulesAreaRand();
				break;
		}
		lirResetField();
		lirDrawField();
	}
}

// ShowGrid changed
function lirGridChange() {
	if (lirPageLoaded) {
		lirShowGrid = lirCheckboxGrid.checked;
		lirDrawField();
	}
}

// ShowAgecolors changed
function lirAgecolorsChange() {
	if (lirPageLoaded) {
		lirShowAgecolors = lirCheckboxAgecolors.checked;
		lirDrawField();
	}
}



// Additional low-level math...
function lirHeaviside(value) { // Should be 1 for positive value, 0 for the rest
	return (value > 0) ? 1 : 0; // exercise: optimize it platform-independently to avoid execution branches... in the absence of Math.sign()
}

function lirIncBinLog(value, maxLog) { // 0 for 0, then incremented binary logarithm up to maxLog
	var res = 0;

	while ((value > 0) && (res < maxLog)) {
		value >>= 1;
		res++;
	}

	return res;
}


// Field-related functions...
function lirInitField() {
	lirFieldCurrent = new Array(lirFieldSize);
	lirFieldNext = new Array(lirFieldSize);
	lirFieldProtect = new Array(lirFieldSize);

	for (var y = 0; y < lirFieldSize; y++) {
		lirFieldCurrent[y] = new Array(lirFieldSize);
		lirFieldNext[y] = new Array(lirFieldSize);

		lirFieldProtect[y] = new Array(lirFieldSize);
		for (var x = 0; x < lirFieldSize; x++) {
			lirFieldProtect[y][x] = false;
		}
	}
}

function lirFillCellRect(x, y, w, h, v) {
	for (var i = y; i < (y + h); i++) {
		for (var j = x; j < (x + w); j++) {
			lirFieldCurrent[i][j] = v;
		}
	}
}

function lirSetAliveCells(cells) { // cells = [[x1, y1], [x2, y2], ...]
	for (var i = 0; i < cells.length; i++) {
		lirFieldCurrent[cells[i][1]][cells[i][0]] = 1;
	}
}

function lirFillCellProtectRect(x, y, w, h, v) {
	for (var j = y; j < (y + h); j++) {
		for (var i = x; i < (x + w); i++) {
			lirFieldProtect[j][i] = v;
		}
	}
}

function lirClearField() {
	lirFillCellRect(0, 0, lirFieldSize, lirFieldSize, 0);
	lirFillCellProtectRect(0, 0, lirFieldSize, lirFieldSize, false);
}

function lirCheckCell(x, y) {
	return (lirFieldCurrent[y][x] > 0);
}

function lirNegateCellRect(x, y, w, h) {
	for (var i = y; i < (y + h); i++) {
		for (var j = x; j < (x + w); j++) {
			if (!lirFieldProtect[i][j]) {
				lirFieldCurrent[i][j] = (lirFieldCurrent[i][j] > 0) ? 0 : 1;
			}
		}
	}
}

// Graphics...
function lirDrawPixel(x, y, colorIndex) {
	var paletteEntry = lirPalette[colorIndex];
	var red = paletteEntry[0];
	var green = paletteEntry[1];
	var blue = paletteEntry[2];

	var offset = (y * lirCanvasSize + x) << 2; // RGBA for each pixel

	lirCanvasRawData[offset+0] = red;
	lirCanvasRawData[offset+1] = green;
	lirCanvasRawData[offset+2] = blue;
	lirCanvasRawData[offset+3] = 0xFF;
}

function lirDrawRect(x, y, w, h, colorIndex) {
	for (var i = x; i < (x + w); i++) {
		lirDrawPixel(i, y, colorIndex);
		lirDrawPixel(i, y + h - 1, colorIndex);
	}
	for (var j = y; j < (y + h); j++) {
		lirDrawPixel(x, j, colorIndex);
		lirDrawPixel(x + w - 1, j, colorIndex);
	}
}

function lirDrawThickRect(x, y, w, h, colorIndex) {
	lirDrawRect(x, y, w, h, colorIndex);
	lirDrawRect(x + 1, y + 1, w - 2, h - 2, colorIndex);
}

function lirDrawGrid(colorIndex) {
	for (var i = 0; i < lirFieldSize; i++) {
		for (var z = 0; z < lirFieldSize * lirCellSize; z++) {
			lirDrawPixel(z, i * lirCellSize, 0x102);
			lirDrawPixel(i * lirCellSize, z, 0x102);
		}
	}
}

function lirDrawCross(x, y, s, colorIndex) {
	for (var i = 0; i < s; i++) {
		lirDrawPixel(x + i, y + i, colorIndex);
		lirDrawPixel(x + s - 1 - i, y + i, colorIndex);
	}
}

function lirFillRect(x, y, w, h, colorIndex) {
	var paletteEntry = lirPalette[colorIndex];
	var red = paletteEntry[0];
	var green = paletteEntry[1];
	var blue = paletteEntry[2];

	var offset = (y * lirCanvasSize + x) << 2; // RGBA for each pixel
	var nextRowOffsetDelta = (lirCanvasSize - w) << 2;

	for (var i = 0; i < h; i++) {
		for (var j = 0; j < w; j++) {
			lirCanvasRawData[offset++] = red;
			lirCanvasRawData[offset++] = green;
			lirCanvasRawData[offset++] = blue;
			lirCanvasRawData[offset++] = 0xFF;
		}

		offset += nextRowOffsetDelta;
	}

}

// -------------------------------- RulesArea: 2c 9r 5x5 --------------------------------

function lirRulesWrite2c9r5x5() {
	// Write flip-flops to "set" bits of standard Life B/D rules
	for (var i = 0; i <= 8; i++) {
		var is_birth = (i == 3) ? true : false;
		if (!is_birth) {
			lirFillCellRect(lirRulesAreaX[0][i] + 1, lirRulesAreaY[0][i] + 2, 3, 1, 1);
		}

		var is_death = ((i < 2) || (i > 3)) ? true : false;
		if (is_death) {
			lirFillCellRect(lirRulesAreaX[1][i] + 1, lirRulesAreaY[1][i] + 2, 3, 1, 1);
		}
	}
}

function lirRulesProtect2c9r5x5() {
	// Protect B0 and D8 to avoid "strobing" (all dead/all alive)
	lirFillCellProtectRect(lirRulesAreaX[0][0] + 2, lirRulesAreaY[0][0] + 2, 1, 1, true);
	lirFillCellProtectRect(lirRulesAreaX[1][8] + 2, lirRulesAreaY[1][8] + 2, 1, 1, true);
}

function lirRulesRead2c9r5x5() {
	for (var i = 0; i <= 8; i++) {
		lirBirthRules[i] = !lirCheckCell(lirRulesAreaX[0][i] + 2, lirRulesAreaY[0][i] + 2);
		lirDeathRules[i] = lirCheckCell(lirRulesAreaX[1][i] + 2, lirRulesAreaY[1][i] + 2);
	}
}

function lirRulesDraw2c9r5x5() {
	// Draw rectangles for "rules" area
	for (var i = 0; i <= 8; i++) {
		for (var j = 0; j < 2; j++) {
			lirDrawThickRect(lirRulesAreaX[j][i] * lirCellSize, lirRulesAreaY[j][i] * lirCellSize, 5 * lirCellSize + 1, 5 * lirCellSize + 1, 0x101);
			lirDrawThickRect((lirRulesAreaX[j][i] + 2) * lirCellSize, (lirRulesAreaY[j][i] + 2) * lirCellSize, lirCellSize + 1, lirCellSize + 1, 0x101);
		}
	}
}

function lirSetRulesArea2c9r5x5(is_far) {
	if (is_far) {
		for (var i = 0; i <= 8; i++) {
			lirRulesAreaX[0][i] = (lirFieldSize >> 2) - 2;
			lirRulesAreaX[1][i] = (lirFieldSize >> 2) - 2 + (lirFieldSize >> 1);
			for (var j = 0; j < 2; j++) {
				lirRulesAreaY[j][i] = Math.floor(lirFieldSize / 18) - 2 + Math.floor(lirFieldSize / 9) * i;
			}
		}
	} else {
		for (var i = 0; i <= 8; i++) {
			lirRulesAreaX[0][i] = (lirFieldSize >> 1) - 5;
			lirRulesAreaX[1][i] = lirFieldSize >> 1;
			for (var j = 0; j < 2; j++) {
				lirRulesAreaY[j][i] = (lirFieldSize >> 1) - 5 * 4 + 5 * i;
			}
		}
	}

	lirRulesWriteFunc = lirRulesWrite2c9r5x5;
	lirRulesProtectFunc = lirRulesProtect2c9r5x5;
	lirRulesReadFunc = lirRulesRead2c9r5x5;
	lirRulesDrawFunc = lirRulesDraw2c9r5x5;
}

// -------------------------------- RulesArea: 2c 9r 4x4 --------------------------------

function lirRulesWrite2c9r4x4() {
	// Write tetras to "set" bits of standard Life B/D rules
	for (var i = 0; i <= 8; i++) {
		var is_birth = (i == 3) ? true : false;
		if (!is_birth) {
			lirFillCellRect(lirRulesAreaX[0][i] + 1, lirRulesAreaY[0][i] + 1, 2, 2, 1);
		}

		var is_death = ((i < 2) || (i > 3)) ? true : false;
		if (is_death) {
			lirFillCellRect(lirRulesAreaX[1][i] + 1, lirRulesAreaY[1][i] + 1, 2, 2, 1);
		}
	}
}

function lirRulesProtect2c9r4x4() {
	// Protect B0 and D8 to avoid "strobing" (all dead/all alive)
	lirFillCellProtectRect(lirRulesAreaX[0][0] + 1, lirRulesAreaY[0][0] + 1, 1, 1, true);
	lirFillCellProtectRect(lirRulesAreaX[1][8] + 1, lirRulesAreaY[1][8] + 1, 1, 1, true);
}

function lirRulesRead2c9r4x4() {
	for (var i = 0; i <= 8; i++) {
		lirBirthRules[i] = !lirCheckCell(lirRulesAreaX[0][i] + 1, lirRulesAreaY[0][i] + 1);
		lirDeathRules[i] = lirCheckCell(lirRulesAreaX[1][i] + 1, lirRulesAreaY[1][i] + 1);
	}
}

function lirRulesDraw2c9r4x4() {
	// Draw rectangles for "rules" area
	for (var i = 0; i <= 8; i++) {
		for (var j = 0; j < 2; j++) {
			lirDrawThickRect(lirRulesAreaX[j][i] * lirCellSize, lirRulesAreaY[j][i] * lirCellSize, 4 * lirCellSize + 1, 4 * lirCellSize + 1, 0x101);
			lirDrawThickRect((lirRulesAreaX[j][i] + 1) * lirCellSize, (lirRulesAreaY[j][i] + 1) * lirCellSize, lirCellSize + 1, lirCellSize + 1, 0x101);
		}
	}
}

function lirSetRulesArea2c9r4x4(is_far) {
	if (is_far) {
		for (var i = 0; i <= 8; i++) {
			lirRulesAreaX[0][i] = (lirFieldSize >> 2) - 1;
			lirRulesAreaX[1][i] = (lirFieldSize >> 2) - 1 + (lirFieldSize >> 1);
			for (var j = 0; j < 2; j++) {
				lirRulesAreaY[j][i] = Math.floor(lirFieldSize / 18) - 1 + Math.floor(lirFieldSize / 9) * i;
			}
		}
	} else {
		for (var i = 0; i <= 8; i++) {
			lirRulesAreaX[0][i] = (lirFieldSize >> 1) - 4;
			lirRulesAreaX[1][i] = lirFieldSize >> 1;
			for (var j = 0; j < 2; j++) {
				lirRulesAreaY[j][i] = (lirFieldSize >> 1) - 18 + 4 * i;
			}
		}
	}

	lirRulesWriteFunc = lirRulesWrite2c9r4x4;
	lirRulesProtectFunc = lirRulesProtect2c9r4x4;
	lirRulesReadFunc = lirRulesRead2c9r4x4;
	lirRulesDrawFunc = lirRulesDraw2c9r4x4;
}

// -------------------------------- RulesArea: 2 x 9 pairs --------------------------------

function lirRulesWrite2x9pairs() {
	// Write pairs to "set" bits of standard Life B/D rules
	for (var i = 0; i <= 8; i++) {
		var is_birth = (i == 3) ? true : false;
		if (!is_birth) {
			lirFillCellRect(lirRulesAreaX[0][i], lirRulesAreaY[0][i], 1, 1, 1);
			lirFillCellRect(lirRulesAreaX[0][i] + 1, lirRulesAreaY[0][i] - 1, 1, 1, 1);
		}

		var is_death = ((i < 2) || (i > 3)) ? true : false;
		if (is_death) {
			lirFillCellRect(lirRulesAreaX[1][i], lirRulesAreaY[1][i], 1, 1, 1);
			lirFillCellRect(lirRulesAreaX[1][i] + 1, lirRulesAreaY[1][i] - 1, 1, 1, 1);
		}
	}
}

function lirRulesProtect2x9pairs() {
	// Protect B0 and D8 to avoid "strobing" (all dead/all alive)
	lirFillCellProtectRect(lirRulesAreaX[0][0], lirRulesAreaY[0][0], 1, 1, 1);
	lirFillCellProtectRect(lirRulesAreaX[1][8], lirRulesAreaY[1][8], 1, 1, 1);
}

function lirRulesRead2x9pairs() {
	for (var i = 0; i <= 8; i++) {
		lirBirthRules[i] = !lirCheckCell(lirRulesAreaX[0][i], lirRulesAreaY[0][i]);
		lirDeathRules[i] = lirCheckCell(lirRulesAreaX[1][i], lirRulesAreaY[1][i]);
	}
}

function lirRulesDraw2x9pairs() {
	// Draw rectangles for "rules" area
	for (var i = 0; i <= 8; i++) {
		for (var j = 0; j < 2; j++) {
			lirDrawThickRect(lirRulesAreaX[j][i] * lirCellSize, lirRulesAreaY[j][i] * lirCellSize, lirCellSize + 1, lirCellSize + 1, 0x101);
		}
	}
}

function lirSetRulesArea2x9pairs(is_far) {
	if (is_far) {
		for (var i = 0; i <= 8; i++) {
			lirRulesAreaX[0][i] = (lirFieldSize >> 2) - 6 + i;
			lirRulesAreaX[1][i] = lirRulesAreaX[0][i] + (lirFieldSize >> 1);
			lirRulesAreaY[0][i] = 3 * (lirFieldSize >> 2) - 2 + i;
			lirRulesAreaY[1][i] = lirRulesAreaY[0][i] - (lirFieldSize >> 1);
		}
	} else {
		for (var i = 0; i <= 8; i++) {
			lirRulesAreaX[0][i] = (lirFieldSize >> 1) - 6 + i;
			lirRulesAreaX[1][i] = lirRulesAreaX[0][i] + 3;
			lirRulesAreaY[0][i] = (lirFieldSize >> 1) - 2 + i;
			lirRulesAreaY[1][i] = lirRulesAreaY[0][i] - 3;
		}
	}

	lirRulesWriteFunc = lirRulesWrite2x9pairs;
	lirRulesProtectFunc = lirRulesProtect2x9pairs;
	lirRulesReadFunc = lirRulesRead2x9pairs;
	lirRulesDrawFunc = lirRulesDraw2x9pairs;	
}

// -------------------------------- RulesArea: rand (2 x 9 4x4) --------------------------------

function lirRulesWriteRand() {
	// Write tetras to "set" bits of standard Life B/D rules
	for (var i = 0; i <= 8; i++) {
		var is_birth = (i == 3) ? true : false;
		if (!is_birth) {
			lirFillCellRect(lirRulesAreaX[0][i] + 1, lirRulesAreaY[0][i] + 1, 2, 2, 1);
		}

		var is_death = ((i < 2) || (i > 3)) ? true : false;
		if (is_death) {
			lirFillCellRect(lirRulesAreaX[1][i] + 1, lirRulesAreaY[1][i] + 1, 2, 2, 1);
		}
	}
}

function lirRulesProtectRand() {
	// Protect B0 and D8 to avoid "strobing" (all dead/all alive)
	lirFillCellProtectRect(lirRulesAreaX[0][0] + 1, lirRulesAreaY[0][0] + 1, 1, 1, true);
	lirFillCellProtectRect(lirRulesAreaX[1][8] + 1, lirRulesAreaY[1][8] + 1, 1, 1, true);
}

function lirRulesReadRand() {
	for (var i = 0; i <= 8; i++) {
		lirBirthRules[i] = !lirCheckCell(lirRulesAreaX[0][i] + 1, lirRulesAreaY[0][i] + 1);
		lirDeathRules[i] = lirCheckCell(lirRulesAreaX[1][i] + 1, lirRulesAreaY[1][i] + 1);
	}
}

function lirRulesDrawRand() {
	// Draw rectangles for "rules" area
	for (var i = 0; i <= 8; i++) {
		for (var j = 0; j < 2; j++) {
			lirDrawThickRect(lirRulesAreaX[j][i] * lirCellSize, lirRulesAreaY[j][i] * lirCellSize, 4 * lirCellSize + 1, 4 * lirCellSize + 1, 0x101);
			lirDrawThickRect((lirRulesAreaX[j][i] + 1) * lirCellSize, (lirRulesAreaY[j][i] + 1) * lirCellSize, lirCellSize + 1, lirCellSize + 1, 0x101);
		}
	}
}

function lirSetRulesAreaRand() {
	// Generate random positions of 18 non-intersecting 4x4 aligned squares
	var m = lirFieldSize >> 2;
	var posInds = new Array(18);
	for (var i = 0; i < 18; i++) {
		do {
			posInds[i] = Math.floor(Math.random() * (m * m));
			var present = false;
			for (var j = 0; j < i; j++) {
				if (posInds[i] == posInds[j]) {
					present = true;
					break;
				}
			}
		} while (present);
	}

	for (var j = 0; j < 2; j++) {
		for (var i = 0; i <= 8; i++) {
			var k = j * 9 + i;
			lirRulesAreaX[j][i] = (posInds[k] % m) << 2;
			lirRulesAreaY[j][i] = (Math.floor(posInds[k] / m)) << 2;
		}
	}

	lirRulesWriteFunc = lirRulesWriteRand;
	lirRulesProtectFunc = lirRulesProtectRand;
	lirRulesReadFunc = lirRulesReadRand;
	lirRulesDrawFunc = lirRulesDrawRand;
}

// -------------------------------- RulesArea: ??? --------------------------------


function lirResetField() {
	lirClearField();
	lirRulesWriteFunc();
	lirRulesProtectFunc();

	lirTimeSteps = 0;
}

function lirFlipCurrentNext() { // swapping pointers instead of copying...
	var storedPointer = lirFieldCurrent;

	lirFieldCurrent = lirFieldNext;
	lirFieldNext = storedPointer;
}

function lirCountAliveNeighbours(y, x) {
	var an = 0;

	an += lirHeaviside(lirFieldCurrent[y][(x + 1) & lirFieldSizeMask]);
	an += lirHeaviside(lirFieldCurrent[(y + 1) & lirFieldSizeMask][(x + 1) & lirFieldSizeMask]);
	an += lirHeaviside(lirFieldCurrent[(y + 1) & lirFieldSizeMask][x]);
	an += lirHeaviside(lirFieldCurrent[(y + 1) & lirFieldSizeMask][(x - 1) & lirFieldSizeMask]);
	an += lirHeaviside(lirFieldCurrent[y][(x - 1) & lirFieldSizeMask]);
	an += lirHeaviside(lirFieldCurrent[(y - 1) & lirFieldSizeMask][(x - 1) & lirFieldSizeMask]);
	an += lirHeaviside(lirFieldCurrent[(y - 1) & lirFieldSizeMask][x]);
	an += lirHeaviside(lirFieldCurrent[(y - 1) & lirFieldSizeMask][(x + 1) & lirFieldSizeMask]);

	return an;
}

function lirUpdateField() { // main one...
	lirRulesReadFunc();

	for (var y = 0; y < lirFieldSize; y++) {
		for (var x = 0; x < lirFieldSize; x++) {

			var cellAge = lirFieldCurrent[y][x];
			var cellAlive = lirHeaviside(cellAge);

			var cellAliveNeighbours = lirCountAliveNeighbours(y, x);

			var cellNextState = cellAlive;

			if (!lirFieldProtect[y][x]) {
				if (cellAlive == 0) {
					if (lirBirthRules[cellAliveNeighbours]) {
						cellNextState = 1;
					}
				} else {
					if (lirDeathRules[cellAliveNeighbours]) {
						cellNextState = 0;
					}
				}
			}

			var deltaAge = cellNextState + (1 - cellNextState) * (-cellAge * cellAlive);
// if cellNextState = 1, it's 1 regardless of current state (age increments);
// otherwise, it's 0 for empty cell and (-cellAge) for alive one
// (so that cellAge + (-cellAge) = 0 => cell becomes empty)

			lirFieldNext[y][x] = cellAge + deltaAge;
		}
	}

	lirFlipCurrentNext();

	lirTimeSteps++;
}


function lirDrawField() {
	var nAlive = 0;

	for (var y = 0; y < lirFieldSize; y++) {
		for (var x = 0 ; x < lirFieldSize; x++) {
			cellAge = lirFieldCurrent[y][x];
			nAlive += (cellAge > 0) ? 1 : 0;
			var colorIndex = Math.min(0xFF, cellAge);
			if (!lirShowAgecolors) {
				colorIndex = (colorIndex > 0) ? 0x100 : 0;
			}

			lirFillRect(x * lirCellSize, y * lirCellSize, lirCellSize, lirCellSize, colorIndex);

			// Draw cross if cell is protected
			if (lirFieldProtect[y][x]) {
				lirDrawCross(x * lirCellSize, y * lirCellSize, lirCellSize, 0x101);
			}
		}
	}

	if (lirShowGrid) {
		lirDrawGrid();
	}

	lirRulesDrawFunc();

	lirCanvasContext.putImageData(lirCanvasImageData, 0, 0);

	lirCanvas.title = "Time: " + lirTimeSteps + "\nAlive: " + nAlive + ", Dead: " + (lirFieldSize * lirFieldSize - nAlive);
}


function lirSyncField() {
	lirUpdateField();
	lirDrawField();
}


// Generating palette...
function lirMakePalette() {
	lirPalette[0] = lirRainbowColors[0];

	for (var i = 1; i < 0x100; i++) {
		lirPalette[i] = lirRainbowColors[lirIncBinLog(i, 8)];
	}

	lirPalette[0x100] = [0xFF, 0xFF, 0xFF]; // white
	lirPalette[0x101] = [0x80, 0x80, 0x80]; // grey
	lirPalette[0x102] = [0x40, 0x40, 0x40]; // dark grey
}


// Initialization...
window.onload = function() {
	lirPageLoaded = true;

	lirSetRulesArea2c9r5x5(false);

	lirInitField();

	lirResetField();

	lirMakePalette();

	lirSyncTimerID = window.setInterval("lirSyncField()", 1000 / lirFramerate);
}


// Edit field by click on it...
lirCanvas.onclick = function(event) {
	if (lirPageLoaded) {

		if (lirFramerate == 0) {
			var fX = Math.floor(event.offsetX / lirCellSize);
			var fY = Math.floor(event.offsetY / lirCellSize);

			d = event.shiftKey ? 2 : 0;

			for (var y = fY - d; y <= (fY + d); y++) {
				for (var x = fX - d; x <= (fX + d); x++) {
					if ((x >= 0) && (x < lirFieldSize) && (y >= 0) && (y < lirFieldSize)) {
						if (event.ctrlKey) {
							lirFieldProtect[y][x] = !lirFieldProtect[y][x];
						} else if (!lirFieldProtect[y][x]) {
							lirFieldCurrent[y][x] = 1 - lirHeaviside(lirFieldCurrent[y][x]); // empty becomes alive, and vice versa
						}							
					}
				}
			}

		}

		lirDrawField();
	}
}

document.onkeypress = function(event) {
	if (lirPageLoaded) {
		console.log(event.keyCode);
		if ((event.keyCode >= 48) && (event.keyCode <= 57)) { // 0 to 9 framerate
			lirSliderFramerate.value = Math.floor((event.keyCode - 48) * lirMaxFramerate / 10);
			lirFramerateChange();
		} else if (event.keyCode == 109) { // (M)ax framerate
			lirSliderFramerate.value = lirMaxFramerate;
			lirFramerateChange();
		} else if (event.keyCode == 110) { // (N)ext
			if (lirFramerate == 0) {
				lirUpdateField();
				lirDrawField();
			}
		} else if (event.keyCode == 105) { // (I)nvert
			lirNegateCellRect(0, 0, lirFieldSize, lirFieldSize);
			lirDrawField();
		} else if (event.keyCode == 114) { // (R)eset
			lirResetField();
			lirDrawField();
		} else if (event.keyCode == 103) { // Reset and add 4 (G)liders
			lirResetField();
			lirSetAliveCells([[2, 1], [3, 2], [1, 3], [2, 3], [3, 3]]);
			lirSetAliveCells([[lirFieldSize - 3, 1], [lirFieldSize - 4, 2], [lirFieldSize - 2, 3], [lirFieldSize - 3, 3], [lirFieldSize - 4, 3]]);
			lirSetAliveCells([[2, lirFieldSize - 2], [3, lirFieldSize - 3], [1, lirFieldSize - 4], [2, lirFieldSize - 4], [3, lirFieldSize - 4]]);
			lirSetAliveCells([[lirFieldSize - 3, lirFieldSize - 2], [lirFieldSize - 4, lirFieldSize - 3], [lirFieldSize - 2, lirFieldSize - 4], [lirFieldSize - 3, lirFieldSize - 4], [lirFieldSize - 4, lirFieldSize - 4]]);
			lirDrawField();
		}
	}
}
