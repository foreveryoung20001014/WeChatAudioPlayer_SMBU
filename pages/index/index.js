const rates = []
let debounceTimer = null; 

Page({
  data: {
    language: 'russian',  // default to Russian
    texts: {
        russian: {
            task: "Задание: прослушайте фразу много раз, повторяйте ее вместе с диктором",
            loading: "Загрузка...",
            repeatedTimes: "Повторенные разы：",
            num: "Номер",
            setSRT: " ",
            
        },
        chinese: {
            task: "任务：多次听取这个短语，然后跟着播音员重复。",
            loading: "加载中...",
            repeatedTimes: "重复次数：",
            num: "曲目",
            setSRT: " ",
        }
    },
    // ... rest of the data properties ...
    rateOptions: {
        russian: ["быстро", "нормально", "медленно"],
        chinese: ["加速", "正常", "慢速"]
    },
    switchLanguageButton: {
        russian: "中文",
        chinese: "Русский"
    },
    //基础功能
    pathindex: 0,
    audioPaths: [],
    isPlaying: false,
    currentProgress: 0,
    isSlow: false,
    playStatus: ' ',
    playCounts: [],
    currentPlayCount: 0,
    isLoading: false,

    //字幕播放
    subtitles: [],
    srtDictionary: {},
    srtContents: [],
    showSRTContent: false,
    audioContext: null, // 音频实例
    currentSubtitle: "", // 当前显示的字幕

    //点击朗读功能
    wordAudioContext: null,
    wordProgressTimer: null,

    //显示当前页面文件
    

    //网络读取
    fileInfo: null,
    srtContent: "",

    //加载页面
    loader:false,

    //慢速播放滚轮
    rates,
    rate: "Normal",
    value: [1],
    isPlayAudio: false,
    title: "Задание: прослушайте фразу много раз, повторяйте ее вместе с диктором",
  },

  onLoad: function () {
    
    var that = this;
    const url_info = 'https://hanni.pro/weixin/info.json';

    this.readInfo(url_info, function() {
      const filecount = that.data.fileInfo.files;
      const url_audio = 'https://hanni.pro/weixin/media/';
      const url_srt = 'https://hanni.pro/weixin/srt/';

      that.loadAudios(url_audio, filecount);
      that.loadSRT(url_srt, filecount);
    });
    
  },

  switchLanguage: function() {
    let newLanguage = this.data.language === 'russian' ? 'chinese' : 'russian';
    this.setData({
        language: newLanguage
    });
  },

   readSrtContent: function(url, callback) {
        var that = this;
        wx.request({
          url: url,
          method: 'GET',
          success: function (res) {
            if (res.statusCode === 200) {
              that.setData({
                srtContent: res.data
              });
            } else {
              that.setData({
                srtContent: " ",
              });
            }
            if (callback) {
              callback();
            }
          },
          fail: function (err) {
            wx.showToast({
              title: 'network error',
              icon: 'none'
            });
          }
        });
  },

  readInfo: function(url, callback) {
    var that = this;
    wx.request({
      url: url,
      method: 'GET',
      success: function(res) {
        that.setData({
          fileInfo: res.data
        });
        if (callback) {
          callback();
        }
      },
      fail: function(error) {
        console.error('Request failed:', error);
      }
    });
  },

  loadSRT: function(url_srt, countAudios) {
    var srtContents;
    var that = this;

    var num = 1;
    while(num <= countAudios) {
      let url = url_srt + "00" + num + ".srt";
      this.readSrtContent(url, function() {
        //console.log(that.data.srtContent); // 直接打印srtContent的内容
        srtContents = that.data.srtContents.concat([that.data.srtContent]);
        const Content = srtContents[0];
        const { subtitles, srtDictionary } = that.convertSRTToDictionary(Content);
        that.setData({
          srtContents: srtContents,
          subtitles: subtitles,
          srtDictionary: srtDictionary,
        });
      }); // 调用新的函数来加载srt文件内容
      num++;
    }
  },

  loadAudios: function(url, countAudios) {
    var AudioPaths = this.data.audioPaths;
    var playCounts = this.data.playCounts;
    var num = 1;
    while(num <= countAudios) {
      AudioPaths.push(url + "00" + num + ".mp3");
      playCounts.push(0);
      num++;
    }
    this.setData({
      audioPaths: AudioPaths,
      playCounts: playCounts,
    });
  },

  //朗读功能
  playWordAudio: function (word) {
    const { start, end } = this.data.srtDictionary[word];
    if (start !== undefined && end !== undefined) {
      if(this.data.isPlaying == true) {
        this.data.audioContext.pause();
      }
      // 停止之前的单词播放，并清除定时器
      if (this.data.wordAudioContext) {
        this.data.wordAudioContext.stop();
        clearInterval(this.data.wordProgressTimer);
      }
      
      // 创建新的音频实例，并设置音频路径和播放的开始时间
      let wordAudioContext = wx.createInnerAudioContext();
      this.setData({ wordAudioContext: wordAudioContext });
      wordAudioContext.src = this.data.audioPaths[this.data.pathindex];
      wordAudioContext.startTime = start / 1000; // 转换为秒
      // 播放音频
      wordAudioContext.play();
  
      // 在指定时间范围后暂停音频
      setTimeout(() => {
        wordAudioContext.stop();
        wordAudioContext.destroy();
      }, (end - start));
    }
  },
  
  // 当用户点击字幕中的单词时，调用这个方法
  onSubtitleWordClick: function (event) {
    const word = event.target.dataset.word; // 假设每个单词都有一个"data-word"属性，其值为单词本身
    this.playWordAudio(word);
  },

  //srt数据转换
  // 选择SRT文件
  convertSRTToDictionary: function (srtContent) {
    const lines = srtContent.split('\n');
    const subtitles = [];
    const srtDictionary = {}; // 用于存储SRT文件内容的字典

    // 使用正则表达式匹配时间戳和字幕信息，并将其提取到字典中
    for (let i = 0; i < lines.length; i += 4) {
      const timeMatch = lines[i + 1].match(/(\d{2}):(\d{2}):(\d{2}),(\d{3}) --> (\d{2}):(\d{2}):(\d{2}),(\d{3})/);
      if (timeMatch) {
        const startHour = parseInt(timeMatch[1]);
        const startMinute = parseInt(timeMatch[2]);
        const startSecond = parseInt(timeMatch[3]);
        const startMillisecond = parseInt(timeMatch[4]);
        const endHour = parseInt(timeMatch[5]);
        const endMinute = parseInt(timeMatch[6]);
        const endSecond = parseInt(timeMatch[7]);
        const endMillisecond = parseInt(timeMatch[8]);

        // 将时间戳转换为毫秒单位并存储在字典中
        const startTime = (startHour * 3600000) + (startMinute * 60000) + (startSecond * 1000) + startMillisecond;
        const endTime = (endHour * 3600000) + (endMinute * 60000) + (endSecond * 1000) + endMillisecond;

        const subtitleText = lines[i + 2].trim();

        const subtitle = {
          startTime: startTime,
          endTime: endTime,
          text: subtitleText,
        };

        subtitles.push(subtitle);

        // 将时间戳作为键，字幕文本作为值，存储到字典中
        srtDictionary[subtitleText] = {
          start: startTime,
          end: endTime
        };
      }
    }

    return {
      subtitles: subtitles,
      srtDictionary: srtDictionary,
    };
  },

  switchToNextPath: function () {
    var nextIndex = this.data.pathindex + 1;
    var audioPaths = this.data.audioPaths;
    if (nextIndex >= audioPaths.length) {
      nextIndex--;
      if(audioPaths.length == 0) {
        wx.showToast({
          title: 'No audio import',
          icon: 'none',
          duration: 1000
        });
      }
      return;
    }
    
    this.setData({
      loader: true,
    });

    //更新音频播放
    var playCounts = this.data.playCounts;
    var currentPlayCount = playCounts[nextIndex];

    var currentPath = audioPaths[nextIndex];
    var audioContext = this.data.audioContext;
    if (audioContext) {
      audioContext.stop();
      clearInterval(this.progressTimer);
      audioContext.destroy();
      this.setData({
        currentPath: currentPath,
        audioContext: null,
        isPlaying: false,
      });
    }

    var signSRT_ch;
    var signSRT_ru;
    var srtContents = this.data.srtContents;
    if(srtContents[nextIndex] != undefined && srtContents[nextIndex] != " ") {
      const srtContent = srtContents[nextIndex];
      //加载srtContent内容
      // 调用转换函数将SRT文件内容转换为字幕信息字典
      const { subtitles, srtDictionary } = this.convertSRTToDictionary(srtContent);
      // 将提取的字幕信息和字典存储到页面数据中，用于渲染到屏幕上
      this.setData({
        subtitles: subtitles,
        srtDictionary: srtDictionary,
        srtContents: srtContents,
      }); 
      signSRT_ch = " ";
      signSRT_ru = " ";
    } else {
      this.setData({
        subtitles: [],
        srtDictionary: {},
      });
      signSRT_ch = "缺少字幕";
      signSRT_ru = "Без субтитров";
    }
    setTimeout(() => {
      let texts = this.data.texts;
      texts['russian'].setSRT = signSRT_ru;
      texts['chinese'].setSRT = signSRT_ch;
      this.setData({
        loader: false,
        pathindex: nextIndex,
        texts: texts,
        currentSubtitle: " ",
        currentProgress: 0,
        isSlow: false,
        isLoading: false,
        playStatus: ' ',
        currentPlayCount: currentPlayCount,
        value: [1],
      });
    }, 1000);
  },
  switchToPrevPath: function () {
    var prevIndex = this.data.pathindex - 1;
    var audioPaths = this.data.audioPaths;
    if (prevIndex < 0) {
      if(audioPaths.length > 0) {
        prevIndex = 0;
      } else {
        prevIndex = 0;
        wx.showToast({
          title: 'No audio import',
          icon: 'none',
          duration: 1000
        });
      }
      return;
    } 

    this.setData({
      loader: true,
    });

    //更新音频播放
    var playCounts = this.data.playCounts;
    var currentPlayCount = playCounts[prevIndex];

    let currentPath = audioPaths[prevIndex];
    let audioContext = this.data.audioContext;
    if (audioContext) {
      audioContext.stop();
      clearInterval(this.progressTimer);
      audioContext.destroy();
      this.setData({
        currentPath: currentPath,
        audioContext: null,
        isPlaying: false,
      });
    }
    var signSRT_ch;
    var signSRT_ru;
    var srtContents = this.data.srtContents;
    if(srtContents[prevIndex] != undefined && srtContents[prevIndex] != " ") {
      const srtContent = srtContents[prevIndex];
      //加载srtContent内容
      // 调用转换函数将SRT文件内容转换为字幕信息字典
      const { subtitles, srtDictionary } = this.convertSRTToDictionary(srtContent);
      // 将提取的字幕信息和字典存储到页面数据中，用于渲染到屏幕上
      this.setData({
        subtitles: subtitles,
        srtDictionary: srtDictionary,
        srtContents: srtContents,
      }); 
      signSRT_ch = " ";
      signSRT_ru = " ";
    } else {
      this.setData({
        subtitles: [],
        srtDictionary: {},
      });
      signSRT_ch = "缺少字幕";
      signSRT_ru = "Без субтитров";
    }
    setTimeout(() => {
      let texts = this.data.texts;
      texts['russian'].setSRT = signSRT_ru;
      texts['chinese'].setSRT = signSRT_ch;
      this.setData({
        loader: false,
        pathindex: prevIndex,
        texts: texts,
        currentSubtitle: " ",
        currentProgress: 0,
        isSlow: false,
        isLoading: false,
        playStatus: ' ',
        currentPlayCount: currentPlayCount,
        value: [1],
      });
    }, 1000);
  },
  
  prepareAudio: function () {
    let audioPaths = this.data.audioPaths;
    let currentPath = audioPaths[this.data.pathindex];  
    let audioContext = this.data.audioContext;
    if (!audioContext) {
      audioContext = wx.createInnerAudioContext();
      this.setData({ 
        audioContext: audioContext,
      });
      audioContext.src = currentPath;
      audioContext.onCanplay(() => {
        audioContext.play();
      })
      audioContext.onWaiting(() => {
        this.setData({
          isLoading: true // 在监听函数结束后取消 loading
        });
      })
      audioContext.onPlay(() => {
        this.setData({ 
          isPlaying: true,
          isLoading: false,
        });
        clearInterval(this.progressTimer);
        this.progressTimer = setInterval(() => {
          const currentSrtTime = audioContext.currentTime * 1000; // 将秒转换为毫秒
          const progress = Math.floor(audioContext.currentTime / audioContext.duration * 1000.0)/10.0;
          this.setData({ 
            currentProgress: progress,
            isLoading: false,
          });
          if(this.data.subtitles){
            const subtitle = this.findSubtitleAtTime(currentSrtTime);
            if (subtitle) {
              this.setData({
                currentSubtitle: subtitle,
              });
            }   
          }
        }, 100);
      });
      audioContext.onEnded(() => { 
        var playCounts = this.data.playCounts;
        var index = this.data.pathindex;
        playCounts[index] += 1;
        var currentPlayCount = playCounts[index];
        this.setData({
          playCounts: playCounts,
          currentPlayCount: currentPlayCount,
          currentProgress:100,
          isPlaying: false,
        });
        clearInterval(this.progressTimer);

        this.setData({
          isPlaying: true,
        });
        audioContext.play();
      });
      audioContext.onError((res) => {
        console.log(res.errMsg)
        console.log(res.errCode)
      })
    }
  },

  playAudio: function () {
    if(this.data.audioContext && this.data.audioContext.paused == false) {
      return;
    }
    var audioPaths = this.data.audioPaths;
    if (audioPaths.length > 0) { 
      this.prepareAudio();
      let audioContext = this.data.audioContext;
      this.setData({
        isPlaying: true,
      });
      audioContext.play();
    }
    else {
      wx.showToast({
        title: 'Please import file',
        icon: 'none',
        duration: 1000
      });
    }
  },

  findSubtitleAtTime: function (timestamp) {
    let left = 0;
    let right = this.data.subtitles.length - 1;
  
    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      const subtitle = this.data.subtitles[mid];
  
      if (timestamp >= subtitle.startTime && timestamp <= subtitle.endTime) {
        return subtitle.text;
      } 
      if (timestamp < subtitle.startTime) {
        right = mid - 1;
      } else {
        left = mid + 1;
      }
    }
    return ""; // 如果未找到对应的字幕，返回空字符串
  },  

  pauseAudio: function () {
    if (this.data.audioContext && this.data.isPlaying) {
      this.data.audioContext.pause();
      this.setData({
        isPlaying: false,
      });
    }
  },
  
  slowPlayAudio: function () {
    var audioContext = this.data.audioContext;
    if (audioContext) {
      // 检查isSlow的值，如果为true，则播放速度设置为原速，否则设置为慢速
      if (this.data.isSlow) {
        this.setData({ 
          isSlow: false, 
          playStatus: ' ',
        });
      } else {
        this.setData({ 
          isSlow: true, 
          playStatus: 'Slow',
        });
      }
    } else {
      wx.showToast({
        title: 'No audio playing',
        icon: 'none',
        duration: 1000
      });
    }
  },
  bindChange: function(e) {
    // Clear the existing debounce timer
    if (debounceTimer) {
      clearTimeout(debounceTimer);
     } 
    // Set the new debounce timer
    debounceTimer = setTimeout(() => {
      if(this.data.audioContext == null) {
        this.setData({
          value: [1],
        });
        return;
      }
      const val = e.detail.value;
      switch(val[0]){
        case 0: 
          this.data.audioContext.playbackRate = 1.5;
          break;
        case 1:
          this.data.audioContext.playbackRate = 1.0;
          break;
        case 2:
          this.data.audioContext.playbackRate = 0.5;
          break;
      }
      this.data.audioContext.pause();
      if(this.data.audioContext.paused == false) {
        this.data.audioContext.play();
      }
    }, 100); // 300ms delay
  },
  bindPickstart: function() {
    this.setData({
      isPlayAudio: true,
    });
  },
  bindPickend: function() {
    this.setData({
      isPlayAudio: false,
    });
  },
});
