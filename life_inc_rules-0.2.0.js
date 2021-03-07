/*
*	Life-Including-Rules for Web - 2D cellular automaton, part of which defines its birth/death rules
*	v0.2.0, 2021.03.07
*/


// Primary parameters
var lirVersionStr = "0.2.0";

var lirFieldSizeLog = 6;
var lirCellSize = 12;
var lirFramerate = 10;
var lirMaxFramerate = 60;
var lirShowGrid = true;
var lirAgecolors = false;

var lirRainbowColors = new Array(
	new Array(0x00, 0x00, 0x00),  // black
	new Array(0xD0, 0x00, 0xF0),  // violet
	new Array(0x00, 0x00, 0xD0),  // blue
	new Array(0x00, 0x60, 0xFF),  // light-blue
	new Array(0x00, 0xE0, 0xE0),  // cyan (ILLIGAL ALIEN)
	new Array(0x40, 0xC0, 0x00),  // green
	new Array(0xF0, 0xF0, 0x00),  // yellow
	new Array(0xF0, 0x80, 0x00),  // orange
	new Array(0xF0, 0x00, 0x00)); // red

var lirControlsHelpStr = "<i>Controls</i><br><br>0: pause to edit<br>1&ndash;9: speed<br>M: max speed<br>Left-click (speed=0): edit<br>CTRL: protect (freeze)<br>SHIFT: edit 5x5 instead of 1x1<br>Double-click (speed&gt;0): reset<br>G (speed&gt;0): reset and add glider"
var lirRulesAreaHelpStr = "<i>Rules Area</i><br><br>Left column defines birth rules (dead cell &mdash; active rule), right column defines death rules (alive cell &mdash; active rule).<br>Initially it is standard Conway's Life: B3/D0145678."

var lirTextColor = "#000000";
var lirBackgroundColor = "#ffffff";

var lirControlsWidth = 384;
var lirControlsLeftPadding = 64;

var lirControlsFontSize = 20;
var lirHelpFontSize = 17;

// Derived parameters

var lirFieldSize = 1 << lirFieldSizeLog;
var lirFieldSizeMask = lirFieldSize - 1;

var lirRulesAreaX = (lirFieldSize >> 1) - 5;
var lirRulesAreaY = (lirFieldSize >> 1) - 5 * 4;

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


var lirPageLoaded = false;


// Sync timer id
var lirSyncTimerID;
	

// Canvas, controls & other markup
var lirHTML = "";

lirHTML += "<div style=\"float: left;\">";
lirHTML += "<canvas id=\"lir_canvas\" width=\"" + lirCanvasSize + "\" height=\"" + lirCanvasSize + "\" style=\"width: " + lirCanvasSize + "px; height: " + lirCanvasSize + "px;\"></canvas>"; // there are "native" and "on-page" width & height of canvas... ensuring they're equal
lirHTML += "</div>";

lirHTML +=  "<div style=\"float: left; width: " + lirControlsWidth + "px; padding-left: " + lirControlsLeftPadding + "px; padding-bottom: 8px; color: " + lirTextColor + "; background-color: " + lirBackgroundColor + "; font-size: " + lirControlsFontSize + "px;\">";

lirHTML += "<form><table width=" + (lirControlsWidth - lirControlsLeftPadding) + "><tr><td>";

lirHTML += "<tr><td><p style=\"font-size: " + lirControlsFontSize + "px; margin: 8px auto 0px auto;\"><input type=\"checkbox\" id=\"lirCheckboxGrid\" checked onChange=\"lirGridChange()\" /> &nbsp;&nbsp; <label>Grid</label></p></td></tr>";

lirHTML += "<tr><td><p style=\"font-size: " + lirControlsFontSize + "px; margin: 8px auto 0px auto;\"><input type=\"checkbox\" id=\"lirCheckboxAgecolors\" title=\"Newer (violet) to older (red), log-rainbow palette\" onChange=\"lirAgecolorsChange()\" /> &nbsp;&nbsp; <label>Agecolors</label></p></td></tr>";

lirHTML += "<tr><td><p style=\"font-size: " + lirControlsFontSize + "px; margin: 8px auto 0px auto;\">Speed: &nbsp; <input type=\"range\" id=\"lirSliderFramerate\" title=\"Generations per second (roughly)\n0 to pause and edit\" min=\"0\" max=\"" + lirMaxFramerate + "\" step=\"1\" value=\"" + lirFramerate + "\" style=\"width: 120px;\" onChange=\"lirFramerateChange()\" /> &nbsp;&nbsp; <label id=\"lirLabelFramerate\">" + lirFramerate + "</label></p></td></tr>";

lirHTML += "<tr><td><hr><hr><p style=\"font-size: " + lirHelpFontSize + "px; margin: 8px auto 0px auto;\">" + lirControlsHelpStr + "</p></td></tr>";

lirHTML += "<tr><td><hr><p style=\"font-size: " + lirHelpFontSize + "px; margin: 8px auto 0px auto;\">" + lirRulesAreaHelpStr + "</p></td></tr>";

lirHTML += "<tr><td><hr><p style=\"font-size: " + lirHelpFontSize + "px; margin: 8px auto 0px auto;\">Version " + lirVersionStr + "</p></td></tr>";

lirHTML += "</table></form></div>";

lirHTML +=  "<div style=\"clear: both; height: 0px;\">&nbsp;</div>";


document.write(lirHTML);

document.close();


var lirCanvas = document.getElementById("lir_canvas");
var lirCanvasContext = lirCanvas.getContext("2d");
var lirCanvasImageData = lirCanvasContext.getImageData(0, 0, lirCanvasSize, lirCanvasSize);
var lirCanvasRawData = lirCanvasImageData.data;


// Handler of grid changing
function lirGridChange() {
	if (lirPageLoaded) {
		lirShowGrid = lirCheckboxGrid.checked;
		lirDrawField();
	}
}

// Handler of agecolors changing
function lirAgecolorsChange() {
	if (lirPageLoaded) {
		lirAgecolors = lirCheckboxAgecolors.checked;
		lirDrawField();
	}
}

// Handler of framerate changing
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
	for (var j = y; j < (y + h); j++) {
		for (var i = x; i < (x + w); i++) {
			lirFieldCurrent[j][i] = v;
		}
	}
}

function lirFillCellProtectRect(x, y, w, h, v) {
	for (var j = y; j < (y + h); j++) {
		for (var i = x; i < (x + w); i++) {
			lirFieldProtect[j][i] = v;
		}
	}
}

function lirCheckCell(x, y) {
	return (lirFieldCurrent[y][x] > 0);
}

function lirClearField() {
	lirFillCellRect(0, 0, lirFieldSize, lirFieldSize, 0);
}

function lirResetField() {
	lirClearField();
	for (var y = 0; y < lirFieldSize; y++) {
		for (var x = 0; x < lirFieldSize; x++) {
			lirFieldProtect[y][x] = false;
		}
	}

	// Write flip-flops to "set" bits of standard Life B/D rules
	for (var i = 0; i <= 8; i++) {
		var is_birth = (i == 3) ? true : false;
		if (!is_birth) {
			lirFillCellRect(lirRulesAreaX + 1, lirRulesAreaY + 5 * i + 2, 3, 1, 1);
		}

		var is_death = ((i < 2) || (i > 3)) ? true : false;
		if (is_death) {
			lirFillCellRect(lirRulesAreaX + 5 + 1, lirRulesAreaY + 5 * i + 2, 3, 1, 1);
		}
	}

	// Protect B0, D0 and B8,D8 to avoid "flashing" (all dead/all alive)
	lirFillCellProtectRect(lirRulesAreaX, lirRulesAreaY, 5*2, 5, true);
	lirFillCellProtectRect(lirRulesAreaX, lirRulesAreaY + 5*8, 5*2, 5, true);
}

function lirReadRules() {
	for (var i = 0; i <= 8; i++) {
		lirBirthRules[i] = !lirCheckCell(lirRulesAreaX + 2, lirRulesAreaY + 5 * i + 2);
		lirDeathRules[i] = lirCheckCell(lirRulesAreaX + 5 + 2, lirRulesAreaY + 5* i + 2);
	}
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
	lirReadRules();

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

function lirDrawField() {
	for (var y = 0; y < lirFieldSize; y++) {
		for (var x = 0 ; x < lirFieldSize; x++) {
			var colorIndex = Math.min(0xFF, lirFieldCurrent[y][x]);
			if (!lirAgecolors) {
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

	// Draw rectangles for "rules" area
	for (var j = 0; j <= 8; j++) {
		for (var i = 0; i < 2; i++) {
			lirDrawRect((lirRulesAreaX + i * 5) * lirCellSize, (lirRulesAreaY + j * 5) * lirCellSize, 5 * lirCellSize, 5 * lirCellSize, 0x101);
			lirDrawRect((lirRulesAreaX + i * 5 + 2) * lirCellSize, (lirRulesAreaY + j * 5 + 2) * lirCellSize, lirCellSize, lirCellSize, 0x101);
		}
	}

	lirCanvasContext.putImageData(lirCanvasImageData, 0, 0);
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
						} else {
							lirFieldCurrent[y][x] = 1 - lirHeaviside(lirFieldCurrent[y][x]); // empty becomes alive, and vice versa
						}							
					}
				}
			}

		}

		lirDrawField();
	}
}

lirCanvas.ondblclick = function() {
	if (lirPageLoaded) {
		if (lirFramerate > 0) {
			lirResetField();
			lirDrawField();
		}
	}
}

document.onkeypress = function(event) {
	if (lirPageLoaded) {
		console.log(event.keyCode);
		if ((event.keyCode >= 48) && (event.keyCode <= 57)) { // 0 to 9 framerate
			lirSliderFramerate.value = event.keyCode - 48;
			lirFramerateChange();
		} else if (event.keyCode == 109) { // "(M)ax framerate"
			lirSliderFramerate.value = lirMaxFramerate;
			lirFramerateChange();
		} else if (event.keyCode == 103) { // "Reset and add (G)lider"
			if (lirFramerate > 0) {
				lirResetField();
				lirFieldCurrent[3][2] = 1;
				lirFieldCurrent[4][0] = 1; lirFieldCurrent[4][2] = 1;
				lirFieldCurrent[5][1] = 1; lirFieldCurrent[5][2] = 1;
				lirDrawField();
			}
		}
	}
}
