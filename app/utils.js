'use strict';
const _ = require('lodash');
module.exports = {

    _: require('lodash'),

    byteTohex: function(byte) {
        byte = parseInt(byte, 2);
        return parseInt(byte.toString(16), 16);
    },

    intToBit: function(x) {
        var str = x.toString(2);
        var c = 8 - str.length;
        for (var i = 0; i < c; i++) {
            str = "0" + str;
        }
        var bit = str.split("");
        for (var i = 0; i < bit.length; i++) {
            bit[i] = parseInt(bit[i]);
        }
        return bit;
    },

    intToBitStr: function(x) {
        var str = x.toString(2);
        return str;
    },

    intToHex: function(x) {
        return x.toString(16);
    },


    num10THex: function(num) {
        let hex = num.toString(16);
        return hex.length === 1 ? '' + hex : '' + hex;
    },

    num10THexStr: function(nums) {
        let str = ''
        for (let index = 0; index < nums.length; index++) {
            let hex = num10THex(nums[index])
            str = str + '' + (hex.length == 1 ? '0' + hex : hex);
        }
        return str;
    },

    cmd20: function(value) {
        let arr = []
        for (let i = 0; i < value.length; i++) {
            let val = value.charCodeAt(i)
            arr.push(val)
        }
        return arr;
    },

    array_: {
        '61': '00000',
        '62': '00001',
        '63': '10001',
        '64': '00010',
        '65': '10010',
        '66': '00011',
        '67': '10011',
        '68': '00100',
        '69': '00101',
        '70': '10101',
        '71': '00110',
        '72': '10110',
        '73': '00111',
        '74': '10111',
        '75': '01000',
        '76': '11000',
        '77': '01001',
        '78': '01010',
        '79': '11010',
        '80': '01011',
        '81': '11011',
        '82': '01100',
        '83': '11100',
        '84': '01101',
        '85': '11101',
        '86': '01110',
        '87': '01111',
        '88': '11111',
    },
    array_2: {
        '00000': 61,
        '10000': 61,
        '00001': 62,
        '10001': 63,
        '00010': 64,
        '10010': 65,
        '00011': 66,
        '10011': 67,
        '00100': 68,
        '10100': 68,
        '00101': 69,
        '10101': 70,
        '00110': 71,
        '10110': 72,
        '00111': 73,
        '10111': 74,
        '01000': 75,
        '11000': 76,
        '01001': 77,
        '11001': 77,
        '01010': 78,
        '11010': 79,
        '01011': 80,
        '11011': 81,
        '01100': 82,
        '11100': 83,
        '01101': 84,
        '11101': 85,
        '01110': 86,
        '11110': 86,
        '01111': 87,
        '11111': 88,
    },

    parseData3: function(byte) {
        var bit = intToBit(byte);

        var runMode = bit[5] + "" + bit[6] + "" + bit[7];
        let boot = bit[4]
        var windLevel = bit[1] + "" + bit[2] + "" + bit[3];
        let cpmode = bit[0]
        return {
            runMode,
            boot,
            windLevel,
            cpmode,
        }
    },

    parseData4: function(byte) {
        var bit = intToBit(byte);
        var mute = bit[1]
        let mode = bit[2]
        var wenTwo = bit[3] + "" + bit[4] + "" + bit[5] + "" + bit[6] + "" + bit[7];

        let wdNumber = 0
        if (!!!mode) {
            var wen = this.parseInt(wenTwo, 2);
            wen = wen >= 16 ? wen - 16 : wen;
            wdNumber = wen > 0 ? wen + 16 : 16;
        } else {
            wdNumber = array_2[wenTwo]
        }

        return {
            mute,
            temtyp: mode,
            wdNumber,
        }
    },

    parseData5: function(byte) {
        var bit = intToBit(byte);

        var windLR = bit[0] + "" + bit[1] + "" + bit[2] + "" + bit[3];
        var windTB = bit[4] + "" + bit[5] + "" + bit[6] + "" + bit[7];
        return {
            windLR,
            windTB,
        }
    },

    parseData6: function(byte) {
        var bit = intToBit(byte);
        return {
            lighting: bit[0],
            healthy: bit[1],
            timingMode: bit[2],
            dryingmode: bit[3],
            wdNumberMode: bit[4] + '' + bit[5],
            sleep: bit[6],
            eco: bit[7],
        }
    },

    parseData789: function(byte7, byte8, byte9) {
        let bits7 = this.intToBit(byte7);
        let bits8 = this.intToBit(byte8);
        let bits9 = this.intToBit(byte9);
        let shut = bits7[0]
        let shutT = '' + bits7[1] + '' + bits7[2] + bits7[3] + (_.join(bits9, ''))
        let boot = bits7[4]
        let bootT = '' + bits7[5] + bits7[6] + bits7[7] + (_.join(bits8, ''))
        let bootSec = parseInt(bootT, 2)
        let shutSec = parseInt(shutT, 2)
        let bootHor = parseInt(bootSec / 60)
        let bootSecnd = parseInt(bootSec % 60)
        let shutHor = parseInt(shutSec / 60)
        let shutSecnd = parseInt(shutSec % 60)
        let bootTime = (bootHor >= 10 ? bootHor : '0' + bootHor) + ":" + (bootSecnd >= 10 ? bootSecnd : '0' + bootSecnd)
        let shutTime = (shutHor >= 10 ? shutHor : '0' + shutHor) + ":" + (shutSecnd >= 10 ? shutSecnd : '0' + shutSecnd)
        return {
            bootEnabled: boot,
            bootTime,
            shutEnabled: shut,
            shutTime
        }
    },

    parseData10: function(byte10) {
        return {
            wujiNum: byte10
        }
    },

    parseData11And12: function(type = 0, byte11, byte12) {
        return {
            indoorTemperature: type ? ((byte11 * 1.8) + 32) : byte11 + '.' + byte12
        }
    },

    parseMessage: function(message) {
        let data3 = parseData3(message[4 + 3])
        let data4 = parseData4(message[4 + 4])
        let data5 = parseData5(message[4 + 5])
        let data6 = parseData6(message[4 + 6])
        let data789 = parseData789(message[4 + 7], message[4 + 8], message[4 + 9])
        let data10 = parseData10(message[4 + 10])
        let data11And12 = parseData11And12(data4.temtyp, message[4 + 11], message[4 + 12])
        let cpmode = data3.cpmode
        let mute = data4.mute
        let windMode = parseInt(data3.windLevel, 2)
        if (cpmode) {
            windMode = 8
        } else if (mute) {
            windMode = 7
        }
        let devSt = _.assign(data3, data4, data5, data6, data789, data10, data11And12, {
            windMode
        });
        return devSt
    },

    cmd: function(cmdCom) {
        cmdCom[3] = 0x01
        var code = 0x00;
        for (var i = 0; i < cmdCom.length - 1; i++) {
            code += cmdCom[i]
        }
        cmdCom[cmdCom.length - 1] = code & 0xFF;
        return cmdCom;
    },

    cmd01: function(nowCmd, val) {
        let cmdPos = 4 + 3;
        let byte = nowCmd[cmdPos]
        let bit = this.intToBit(byte);
        bit[4] = val
        nowCmd[cmdPos] = this.byteTohex(bit.join(''));
        if (val) {
            this.cmd14(nowCmd, 0, true)
        }

        if (!val) {
            this.cmd16(nowCmd, 0, true)
        }

        let timeSt = this.parseData789(nowCmd[4 + 7], nowCmd[4 + 8], nowCmd[4 + 9])

        this.cmd18(nowCmd, false, timeSt.bootTime, false, timeSt.shutTime, true)

        return this.cmd(nowCmd)
    },

    cmd02: function(nowCmd, val, modify = false) {
        let cmdPos = 4 + 3;
        let byte = nowCmd[cmdPos]
        let bit = intToBit(byte);
        bit[0] = val
        nowCmd[cmdPos] = byteTohex(bit.join(''));

        if (!modify) {
            cmd06(nowCmd, 0, true)
            cmd03(nowCmd, 0, true)
        }

        return !modify ? cmd(nowCmd) : nowCmd
    },

    cmd03: function(nowCmd, val, modify = false) {
        let _val = val
        val = typeof val === 'number' ? _.padStart(val.toString(2), 3, '0') : val

        let cmdPos = 4 + 3;
        let byte = nowCmd[cmdPos]
        let bit = intToBit(byte);
        bit[1] = +val[0]
        bit[2] = +val[1]
        bit[3] = +val[2]
        nowCmd[cmdPos] = byteTohex(bit.join(''));

        //if (_val == 6) {
        //  cmd04(nowCmd, 60, true)
        //}

        if (!modify) {
            cmd06(nowCmd, 0, true)
            cmd02(nowCmd, 0, true)
        }

        return !modify ? cmd(nowCmd) : nowCmd
    },

    cmd04: function(nowCmd, val, modify = false) {
        val = _.padStart(val.toString(2), 8, '0')

        let cmdPos = 4 + 10;
        nowCmd[cmdPos] = byteTohex(val);

        return !modify ? cmd(nowCmd) : nowCmd
    },

    cmd05: function(nowCmd, val, wdNumber = 0, windLevel = -1, wujiNum = -1, windLR = -1, windTB = -1, modify = false) {
        val = typeof val === 'number' ? _.padStart(val.toString(2), 3, '0') : val

        let cmdPos = 4 + 3;
        let byte = nowCmd[cmdPos]
        let bit = intToBit(byte);
        let oldMode = [bit[5], bit[6], bit[7]].join('')

        bit[5] = +val[0] //
        bit[6] = +val[1] //
        bit[7] = +val[2] //
        nowCmd[cmdPos] = byteTohex(bit.join(''));
        let st = parseData4(nowCmd[4 + 4])
        if (wdNumber > 0) {
            if ((st.temtyp && wdNumber >= 61) || (!st.temtyp && wdNumber <= 31)) {
                nowCmd = cmd07(nowCmd, wdNumber, true)
            }
        } else {
            if (val === '000') {
                nowCmd = cmd07(nowCmd, !st.temtyp ? 25 : 77, true)
            } else if (val === '100') {
                nowCmd = cmd07(nowCmd, !st.temtyp ? 28 : 82, true)
            } else {
                nowCmd = cmd07(nowCmd, !st.temtyp ? 27 : 81, true)
            }
        }

        if (val === '100') {
            if (oldMode != '100')
                nowCmd = cmd14(nowCmd, 1, true)
        }

        if (val === '010') {
            nowCmd = cmd03(nowCmd, 1, true)
            nowCmd = cmd06(nowCmd, 0, true)
            nowCmd = cmd02(nowCmd, 0, true)
        } else if (windLevel > -1) {
            if (windLevel <= 6) {
                nowCmd = cmd03(nowCmd, windLevel, true)
                nowCmd = cmd06(nowCmd, 0, true)
                nowCmd = cmd02(nowCmd, 0, true)

                if (windLevel == 6 && wujiNum > -1) {
                    nowCmd = cmd04(nowCmd, wujiNum, true)
                }
            } else if (windLevel == 7) {
                nowCmd = cmd03(nowCmd, 0, true)
                nowCmd = cmd02(nowCmd, 0, true)
                nowCmd = cmd06(nowCmd, 1, true)
            } else if (windLevel == 8) {
                nowCmd = cmd03(nowCmd, 0, true)
                nowCmd = cmd02(nowCmd, 1, true)
                nowCmd = cmd06(nowCmd, 0, true)
            }

        }

        if (windLR > -1) {
            nowCmd = cmd09(nowCmd, windLR, true)
        }
        if (windTB > -1) {
            nowCmd = cmd10(nowCmd, windTB, true)
        }

        nowCmd = cmd16(nowCmd, 0, true)
        nowCmd = cmd17(nowCmd, 0, true)

        return !modify ? cmd(nowCmd) : nowCmd
    },


    cmd06: function(nowCmd, val, modify = false) {
        let cmdPos = 4 + 4;
        let byte = nowCmd[cmdPos]
        let bit = intToBit(byte);
        bit[1] = val //
        nowCmd[cmdPos] = byteTohex(bit.join(''));

        if (!modify) {
            cmd02(nowCmd, 0, true)
            cmd03(nowCmd, 0, true)
        }

        return !modify ? cmd(nowCmd) : nowCmd
    },

    cmd08: function(nowCmd, val, modify = false) {
        let cmdPos = 4 + 4;
        let byte = nowCmd[cmdPos]
        let bit = intToBit(byte);
        bit[2] = val //
        nowCmd[cmdPos] = byteTohex(bit.join(''));

        return !modify ? cmd(nowCmd) : nowCmd
    },


    cmd07: function(nowCmd, val, modify = false) {
        let cmdPos = 4 + 4;
        let tempSt = parseData4(nowCmd[cmdPos])
        let val2 = ''
        if (!tempSt.temtyp) {
            let _val = val >= 16 ? val - 16 : val
            val2 = _.padStart(_val.toString(2), 5, '0')
        } else {
            val2 = array_['' + val]
        }

        let byte = nowCmd[cmdPos]
        let bit = this.intToBit(byte);
        bit[3] = +val2[0] //
        bit[4] = +val2[1] //
        bit[5] = +val2[2] //
        bit[6] = +val2[3] //
        bit[7] = +val2[4] //
        nowCmd[cmdPos] = this.byteTohex(bit.join(''));

        return !modify ? this.cmd(nowCmd) : nowCmd
    },

    cmd09: function(nowCmd, val, modify = false) {

        val = typeof val === 'number' ? _.padStart(val.toString(2), 4, '0') : val

        let cmdPos = 4 + 5;
        let byte = nowCmd[cmdPos]
        let bit = this.intToBit(byte);
        bit[0] = +val[0] //
        bit[1] = +val[1] //
        bit[2] = +val[2] //
        bit[3] = +val[3] //
        nowCmd[cmdPos] = this.byteTohex(bit.join(''));

        return !modify ? this.cmd(nowCmd) : nowCmd
    },

    cmd10: function(nowCmd, val, modify = false) {
        val = typeof val === 'number' ? _.padStart(val.toString(2), 4, '0') : val

        let cmdPos = 4 + 5;
        let byte = nowCmd[cmdPos]
        let bit = this.intToBit(byte);
        bit[4] = +val[0] //
        bit[5] = +val[1] //
        bit[6] = +val[2] //
        bit[7] = +val[3] //
        nowCmd[cmdPos] = this.byteTohex(bit.join(''));

        return !modify ? this.cmd(nowCmd) : nowCmd
    },

    cmd11: function(nowCmd, val, modify = false) {
        let cmdPos = 4 + 6;
        let byte = nowCmd[cmdPos]
        let bit = this.intToBit(byte);
        bit[0] = val //
        nowCmd[cmdPos] = this.byteTohex(bit.join(''))

        return !modify ? this.cmd(nowCmd) : nowCmd
    },

    cmd12: function(nowCmd, val, modify = false) {
        let cmdPos = 4 + 6;

        let byte = nowCmd[cmdPos]
        let bit = this.intToBit(byte);
        bit[1] = val //
        nowCmd[cmdPos] = this.byteTohex(bit.join(''));

        return !modify ? this.cmd(nowCmd) : nowCmd
    },

    cmd13: function(nowCmd, val, modify = false) {
        let cmdPos = 4 + 6;
        let byte = nowCmd[cmdPos]
        let bit = this.intToBit(byte);
        bit[2] = val //
        nowCmd[cmdPos] = this.byteTohex(bit.join(''));

        return !modify ? this.cmd(nowCmd) : nowCmd
    },

    cmd14: function(nowCmd, val, modify = false) {
        let cmdPos = 4 + 6;
        let byte = nowCmd[cmdPos]
        let bit = this.intToBit(byte);
        bit[3] = val //
        nowCmd[cmdPos] = this.byteTohex(bit.join(''));

        return !modify ? this.cmd(nowCmd) : nowCmd
    },

    cmd15: function(nowCmd, val, modify = false) {
        let cmdPos = 4 + 6;
        let byte = nowCmd[cmdPos]
        let bit = intToBit(byte);
        bit[4] = +val[0] //
        bit[5] = +val[1] //
        nowCmd[cmdPos] = byteTohex(bit.join(''));

        return !modify ? cmd(nowCmd) : nowCmd
    },

    cmd16: function(nowCmd, val, modify = false) {
        let cmdPos = 4 + 6;
        let byte = nowCmd[cmdPos]
        let bit = this.intToBit(byte);
        bit[6] = val //
        nowCmd[cmdPos] = this.byteTohex(bit.join(''));

        if (val) {
            this.cmd17(nowCmd, 0, true)
        }

        return !modify ? this.cmd(nowCmd) : nowCmd
    },

    cmd17: function(nowCmd, val, modify = false) {
        let cmdPos = 4 + 6;
        let byte = nowCmd[cmdPos]
        let bit = intToBit(byte);
        bit[7] = val //
        nowCmd[cmdPos] = byteTohex(bit.join(''));

        if (val) {
            cmd16(nowCmd, 0, true)
            cmd03(nowCmd, 0, true)
        }

        return !modify ? cmd(nowCmd) : nowCmd
    },

    cmd18: function(nowCmd, bootEnabled, bootTime, shutEnabled, shutTime, modify = false) {
        let _bootTime = bootTime.split(':')
        let booSec = parseInt(_bootTime[0]) * 60 + parseInt(_bootTime[1])
        let _shutTime = shutTime.split(':')
        let shutSec = parseInt(_shutTime[0]) * 60 + parseInt(_shutTime[1])
        let bootStr = _.padStart(booSec.toString(2), 11, '0')
        let shutStr = _.padStart(shutSec.toString(2), 11, '0')
        nowCmd[4 + 7] = this.byteTohex('' + (shutEnabled ? 1 : 0) + shutStr.substring(0, 3) + (bootEnabled ? 1 : 0) + bootStr.substring(0, 3));
        nowCmd[4 + 8] = this.byteTohex(bootStr.substring(3, 11));
        nowCmd[4 + 9] = this.byteTohex(shutStr.substring(3, 11));
        return !modify ? this.cmd(nowCmd) : nowCmd
    },

    cmdQuery: function() {
        let nowCmd = [0xAA, 0xAA, 0x12, 0xA0, 0x0A, 0x0A, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x1A]
        return nowCmd
    },

    cmd19: function(endpoint) {

        let arr = cmd20(endpoint)

        let nowCmd = [0xAC, 0xAC, 0x00, 0xB4, ...arr, 0x00, 0x00]
        nowCmd[2] = nowCmd.length - 3
        var code = 0x00;
        for (var i = 0; i < nowCmd.length - 1; i++) {
            code += nowCmd[i]
        }
        nowCmd[nowCmd.length - 1] = code & 0xFF; //

        return nowCmd
    },


}



// WEBPACK FOOTER //
// ./src/services/utils.js
