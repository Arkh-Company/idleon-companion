// Mock of the game script (tests only). CurrentMap follows the clock, so readings change every second and go on changing after a reload.
(function(){var Eng=function(){};Eng.prototype={getGameAttribute:function(e){return this.gameAttributes.h[e]},__class__:Eng};
var gi=[];for(var i=0;i<20;i++)gi.push(0);var ol=[];for(var j=0;j<20;j++)ol.push(0);ol[12]=2;
var pha=[];pha[1]={behaviors:{cache:{h:{"ActorEvents_116":{script:{_GeneralINFO:gi}}}}}};pha[3]={behaviors:{cache:{h:{}}}};
var eng=new Eng();eng.gameAttributes={h:{CurrentMap:264,MenuType:3,MenuType2:0,MenuType2TabSelected:0,SkillTabSelected:18,UserInfo:["Tester"],AFKtarget:"w6d3",OptionsList:ol,PixelHelperActor:pha}};
var map=function(){return Math.floor(Date.now()/1000)%300;};eng.gameAttributes.h.CurrentMap=map();
var n=0;setInterval(function(){eng.getGameAttribute("CurrentMap");n++;gi[2]=n;if(n%10==0){gi[13]=(gi[13]+1)%4;}eng.gameAttributes.h.CurrentMap=map();},200);})();
