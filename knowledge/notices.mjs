// Fictional school and teacher notices for the local prototype; see Help.
const clause=(id,title,published,scope,topic,value,text,extra={})=>({id,title,published,effective:published,imported:published,scope,topic,value,text,supersedes:[],aliases:[],...extra});
const lessonText='2026年11月27日08:00–09:40，计科2班数据库课在A301上课。';
const lesson={activity:'数据库-11月27日',course:'数据库',noticeType:'course',issuer:'数据库任课教师',lessonDate:'2026-11-27',event:{date:'2026-11-27',time:'08:00–09:40',place:'A301',action:'上课'}};
const assignmentText='计科2班数据库作业一：完成ER图设计，于11月26日18:00前在课程平台提交ER图设计作业。';
const assignment={activity:'数据库-作业一',course:'数据库',noticeType:'assignment',issuer:'数据库任课教师',event:{date:'2026-11-26',time:'18:00',place:'课程平台',action:'提交ER图设计作业'}};
export const noticeSeed=[
  clause('DB-ROOM','数据库：11月27日上课安排','2026-11-18','计科2班','数据库·11月27日上课地点','A301',lessonText,{...lesson,field:'room',aliases:['数据库教室','数据库在哪上','周五数据库课教室']}),
  clause('DB-TIME','数据库：11月27日上课安排','2026-11-18','计科2班','数据库·11月27日上课时间','08:00–09:40',lessonText,{...lesson,field:'time',aliases:['数据库几点','数据库什么时候上课','周五数据库课时间']}),
  clause('DB-HW','数据库：作业一提交要求','2026-11-19','计科2班','数据库·作业一要求','完成ER图设计',assignmentText,{...assignment,field:'task',aliases:['数据库作业','作业一要求','ER图设计']}),
  clause('DB-DUE','数据库：作业一提交要求','2026-11-19','计科2班','数据库·作业一截止时间','11月26日18:00',assignmentText,{...assignment,field:'deadline',aliases:['数据库作业截止','作业一什么时候交','数据库作业时间']}),
  clause('DB-SUBMIT','数据库：作业一提交要求','2026-11-19','计科2班','数据库·作业一提交地点','课程平台',assignmentText,{...assignment,field:'channel',aliases:['数据库作业交到哪里','数据库作业提交平台']}),
  clause('LIB-OLD','图书馆：二层开放安排','2026-11-20','全校','图书馆·二层开放安排','09:00–12:00','11月22日09:00–12:00，图书馆二层因设备维护暂停开放。',{noticeType:'school',issuer:'图书馆',field:'service',event:{date:'2026-11-22',time:'09:00–12:00',place:'图书馆二层',action:'暂停开放'},aliases:['图书馆开放','图书馆几点开放']}),
  clause('PY-HW','Python程序设计：列表练习','2026-11-20','计科2班','Python程序设计·列表练习','提交列表练习','计科2班Python程序设计：11月24日20:00前在课程平台提交列表练习。',{activity:'Python-列表练习',course:'Python程序设计',noticeType:'assignment',issuer:'Python任课教师',field:'task',event:{date:'2026-11-24',time:'20:00',place:'课程平台',action:'提交列表练习'},aliases:['Python作业','列表练习']}),
  clause('DB-ROOM-NEW','数据库：11月27日教室调整','2026-11-21','计科2班','数据库·11月27日上课地点','B204','计科2班11月27日数据库课教室由A301调整为B204，取代11月18日公布的教室安排。上课时间仍为08:00–09:40。',{...lesson,field:'room',supersedes:['DB-ROOM'],event:{...lesson.event,place:'B204'},aliases:['数据库教室','数据库在哪上','周五数据库课教室']}),
  clause('DB-DUE-NEW','数据库：作业一截止时间调整','2026-11-21','计科2班','数据库·作业一截止时间','11月27日18:00','计科2班数据库作业一截止时间由11月26日18:00顺延至11月27日18:00，替代11月19日通知的截止要求。请在课程平台提交ER图设计作业。',{...assignment,field:'deadline',supersedes:['DB-DUE'],event:{...assignment.event,date:'2026-11-27'},aliases:['数据库作业截止','作业一什么时候交','数据库作业时间']}),
  clause('LIB-NEW','图书馆：二层暂停开放时间调整','2026-11-21','全校','图书馆·二层开放安排','10:00–12:00','11月22日图书馆二层暂停开放时间由09:00–12:00调整为10:00–12:00，替代11月20日的安排。',{noticeType:'school',issuer:'图书馆',field:'service',supersedes:['LIB-OLD'],event:{date:'2026-11-22',time:'10:00–12:00',place:'图书馆二层',action:'暂停开放'},aliases:['图书馆开放','图书馆几点开放']})
];
