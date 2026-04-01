try { require('dotenv').config(); } catch (err) {} // 本地测试如果安装了 dotenv 可以直接读取 .env 文件
const express = require('express');
const wechat = require('wechat');
const fs = require('fs');
const path = require('path');
const request = require('request');
const QRCode = require('qrcode'); // 引入二维码生成库
const { createCanvas, loadImage, registerFont } = require('canvas'); // 使用canvas库来合并图片
registerFont('./SmileySans-Oblique.ttf', { family: 'SmileySans' }); // 替换为你的字体路径

const qrCodeDir = path.join(__dirname, 'qrcodes');
if (!fs.existsSync(qrCodeDir)) {
  fs.mkdirSync(qrCodeDir);
}

const app = express();

const config = {
  token: process.env.WECHAT_TOKEN,
  appid: process.env.WECHAT_APPID,
  encodingAESKey: process.env.WECHAT_ENCODING_AES_KEY
};

// --- 新增代码：定义用户数据文件的路径 ---
const userDataFilePath = path.join(__dirname, 'userData.json');

// --- 修改代码：将用户数据从文件加载 ---
let userData = {};
try {
  if (fs.existsSync(userDataFilePath)) {
    const data = fs.readFileSync(userDataFilePath, 'utf8');
    userData = JSON.parse(data);
    console.log('用户自定义地点数据已成功加载。');
  }
} catch (err) {
  console.error('加载用户数据失败:', err);
  // 如果加载失败，则使用空对象
  userData = {};
}

// --- 新增代码：创建一个函数用于保存用户数据到文件 ---
function saveUserData() {
  try {
    // 使用 JSON.stringify 的第三个参数 2 来格式化输出，方便查看
    fs.writeFileSync(userDataFilePath, JSON.stringify(userData, null, 2), 'utf8');
  } catch (err) {
    console.error('保存用户数据失败:', err);
  }
}

// --- 新增代码：帮助信息 ---
const HELP_MESSAGE = `请查看 9月14日 公众号发布的更新日志`;


app.use('/', wechat(config, (req, res) => {
  const message = req.weixin;
  if (message.MsgType !== 'text') return res.reply('请发送文本消息');

  const content = message.Content.trim();
  const parts = content.split(/\s+/);
  const command = parts[0].toLowerCase();
  const args = parts.slice(1);
  const user = message.FromUserName;
  
  // 初始化用户数据结构
  if (!userData[user]) {
    userData[user] = { locations: [] };
  }

  switch (command) {
    case 'add':
      return handleAddLocation(user, args, res);
    case 'del':
      return handleDeleteLocation(user, args, res);
    case 'ls':
      return handleListLocations(user, res);
    case 'help':
      return res.reply(HELP_MESSAGE);
    default:
      // 处理地点选择
      if (!isNaN(command) && parts.length === 1) {
        return handleLocationSelection(user, command, res);
      }
      // 非法指令处理
      return res.reply('指令非法，请输入 help 指令查看教程');
  }
}));

// --- 新增代码：处理添加地点 ---
function handleAddLocation(user, args, res) {
  if (args.length < 3) {
    return res.reply(`指令格式错误！\n正确格式: add [名称] [经度] [纬度]\n例如: add 学生公寓7栋 116.0352 28.6890`);
  }
  
  const lat = parseFloat(args.pop());
  const lng = parseFloat(args.pop());
  const name = args.join(' ');

  if (!name || isNaN(lng) || isNaN(lat)) {
    return res.reply(`指令格式错误，经纬度必须为数字！\n正确格式: add [名称] [经度] [纬度]`);
  }

  userData[user].locations.push({ name, lng, lat });
  saveUserData();
  
  return res.reply(`地点 "${name}" 添加成功！`);
}

// --- 新增代码：处理删除地点 ---
function handleDeleteLocation(user, args, res) {
  if (args.length !== 1) {
    return res.reply(`指令格式错误！\n正确格式: del [地点数字ID]`);
  }
  
  const index = parseInt(args[0], 10) - 1;

  if (isNaN(index) || !userData[user].locations[index]) {
    return res.reply('无效的地点ID，请使用 ls 指令查看正确的ID。');
  }

  const deletedLocation = userData[user].locations.splice(index, 1);
  saveUserData();

  return res.reply(`地点 "${deletedLocation[0].name}" 已被删除。`);
}


// --- 修改代码：列出用户自定义的地点 ---
function handleListLocations(user, res) {
  const userLocations = userData[user].locations;
  if (!userLocations || userLocations.length === 0) {
    return res.reply('暂无地点，请输入 help 指令查看教程');
  }
  
  const locationList = userLocations.map((loc, i) => `${i + 1}. ${loc.name}`).join('\n');
  res.reply(`${locationList}`);
}


// 合并二维码图片并显示距离
function mergeQRCodes(filePaths, carNumList, distances, callback) {
  const numCodes = filePaths.length;
  const qrSize = 300; // 每个二维码的大小
  const canvasWidth = 600; // 画布宽度
  const canvasHeight = 600; // 画布高度
  const canvas = createCanvas(canvasWidth, canvasHeight);
  const ctx = canvas.getContext('2d');

  // 加载每个二维码并绘制
  const loadImagePromises = filePaths.map((filePath, index) => {
    return loadImage(filePath).then(image => {
      // 计算二维码的坐标
      let x, y;
      if (index === 0) {
        // 顶部二维码
        x = canvasWidth / 2 - qrSize / 2; // 中心
        y = 0; // 顶部
      } else {
        // 底部二维码
        x = (index - 1) * qrSize; // 左右中心对齐
        y = qrSize; // 底部
      }

      // 绘制二维码背景（白色）
      ctx.fillStyle = 'white'; // 设置背景颜色为白色
      ctx.fillRect(x, y, qrSize, qrSize); // 绘制矩形作为二维码的背景

      // 绘制二维码
      ctx.drawImage(image, x, y, qrSize, qrSize);

      // 在二维码上方绘制带背景的距离文本
      const distanceText = distances[index] ? `距离: ${distances[index]}米` : '距离未知';
      //编号文本
      const carNumText = carNumList[index] ? `编号: ${carNumList[index].slice(-3)}` : '编号未知';

      // 绘制文本背景
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)'; // 透明白色背景

      // 绘制文本
      ctx.font = 'bold 20px SmileySans'; // 使用注册的中文字体并加粗
      ctx.fillStyle = 'black'; // 文本颜色为黑色
      ctx.textAlign = 'center';
	
      ctx.fillText(distanceText, x + 88, y + 20); // 绘制文本在二维码上方
      ctx.fillText(carNumText, x + 3*qrSize / 4, y + 20); 
    });
  });

  // 所有二维码绘制完成后，处理透明区域
  Promise.all(loadImagePromises).then(() => {
    // 将指定的矩形区域设为透明
    ctx.clearRect(0, 0, 150, 300);     // 左上角区域 (0, 0) 到 (150, 300)
    ctx.clearRect(450, 0, 150, 300);   // 右上角区域 (450, 0) 到 (600, 300)

    // 保存最终合并并处理透明后的图片
    const mergedFilePath = path.join(qrCodeDir, 'merged.png');
    const out = fs.createWriteStream(mergedFilePath);
    const stream = canvas.createPNGStream();
    stream.pipe(out);
    out.on('finish', () => {
      callback(mergedFilePath); // 返回合并后的图片路径
    });
  }).catch(err => console.error('加载二维码时出错:', err));
}

// 发送POST请求
function sendPostRequest(postData, callback) {
  const options = {
    url: process.env.API_URL || 'https://api.kvcoogo.com/ManagerApi/api/v1.0.0/queryNearbyCar',
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'Mozilla/5.0 ...',
      'token': process.env.API_TOKEN,
    },
    body: postData,
  };

  request(options, (err, response, body) => {
    if (err || response.statusCode !== 200) return callback([], []);

    const carList = JSON.parse(body).result.carList;
    const selectedCars = carList.filter(car => car.currentPercent > car.lowBattery);
    const carNums = selectedCars.map(car => car.carNum).slice(0, 4); // 只返回前四个可用车辆
    const distances = selectedCars.map(car => car.distance).slice(0, 4); // 获取对应的距离
    callback(carNums, distances); // 返回车辆编号和距离
  });
}

// --- 修改代码：处理用户自定义的地点选择 ---
function handleLocationSelection(user, command, res) {
  const userLocations = userData[user].locations;

  const index = parseInt(command, 10) - 1;
  if (isNaN(index) || !userLocations || !userLocations[index]) {
    return res.reply('无效的地点ID，请使用 ls 指令查看正确的ID。');
  }

  const { lat, lng } = userLocations[index];
  const postData = `lat=${lat}&lng=${lng}&deviceType=1`;
  sendPostRequest(postData, (carNumList, distances) => {
    if (carNumList.length === 0) return res.reply('附近未找到可用的车辆');

    let qrPromises = carNumList.map((carNum) => {
      return new Promise((resolve, reject) => {
        generateQRCode(carNum, filePath => {
          if (!filePath) return reject('二维码生成失败');
          resolve(filePath);
        });
      });
    });

    // 等待所有二维码生成后，合并二维码图片
    Promise.all(qrPromises)
      .then(filePaths => {
        mergeQRCodes(filePaths, carNumList, distances, mergedFilePath => {
          uploadImageToWeChat(mergedFilePath, mediaId => {
            if (!mediaId) return res.reply('二维码上传失败');
            res.reply({ type: 'image', mediaId });
          });
        });
      })
      .catch(err => res.reply('生成二维码失败: ' + err));
  });
}

// 生成二维码函数
function generateQRCode(carNum, callback) {
  const qrCodeUrl = `https://www.kvcoogo.com/ebike?id=${carNum}`;
  const qrImagePath = path.join(qrCodeDir, `${carNum}.png`);

  QRCode.toFile(qrImagePath, qrCodeUrl, err => {
    if (err) return callback(null);
    callback(qrImagePath);
  });
}

// 上传图片到微信服务器
function uploadImageToWeChat(filePath, callback) {
  const appid = config.appid;
  const secret = process.env.WECHAT_APP_SECRET;

  request.get(`https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${appid}&secret=${secret}`, (err, res, body) => {
    if (err || res.statusCode !== 200) return callback(null);

    const accessToken = JSON.parse(body).access_token;
    const formData = { media: fs.createReadStream(filePath) };

    request.post({
      url: `https://api.weixin.qq.com/cgi-bin/media/upload?access_token=${accessToken}&type=image`,
      formData
    }, (err, res, body) => {
      if (!err && res.statusCode === 200) {
        callback(JSON.parse(body).media_id);
      } else {
        callback(null);
      }
    });
  });
}

// 启动服务器
const PORT = process.env.PORT || 80;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

