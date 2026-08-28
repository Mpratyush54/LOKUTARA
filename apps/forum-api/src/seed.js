// ─── Database Seed Script ─────────────────────────────────────────
// Seeds the database with initial data: admin user, sample specialists,
// students, tags, and mock questions/answers.
//
// Usage: npm run seed  (or: node src/seed.js)
//
require('dotenv').config();

const bcrypt = require('bcryptjs');
const { connectDB, closeDB, getDB } = require('./config/database');

const DEFAULT_TAGS = [
    { name: 'mental-health', category: 'psychology' },
    { name: 'stress-management', category: 'psychology' },
    { name: 'motivation', category: 'psychology' },
    { name: 'counselling', category: 'psychology' },
    { name: 'interview', category: 'corporate' },
    { name: 'resume', category: 'corporate' },
    { name: 'leadership', category: 'corporate' },
    { name: 'teamwork', category: 'corporate' },
    { name: 'productivity', category: 'corporate' },
    { name: 'software', category: 'industry' },
    { name: 'ai-ml', category: 'industry' },
    { name: 'internship', category: 'industry' },
    { name: 'startup', category: 'industry' },
    { name: 'project-help', category: 'industry' },
];

async function seed() {
    console.log('🌱 Starting database seed...\n');

    await connectDB();
    const db = getDB();

    // ─── 1. Clear existing data (optional – comment out to append) ───
    await db.collection('users').deleteMany({});
    await db.collection('questions').deleteMany({});
    await db.collection('answers').deleteMany({});
    await db.collection('tags').deleteMany({});
    await db.collection('reports').deleteMany({});
    await db.collection('moderation_logs').deleteMany({});
    console.log('🗑️  Cleared existing data');

    // ─── 2. Create Users ───
    const adminPassword = await bcrypt.hash(process.env.ADMIN_PASSWORD || 'Admin@123', 12);
    const userPassword = await bcrypt.hash('Password@123', 12);

    const usersToCreate = [
        {
            name: 'Admin',
            email: process.env.ADMIN_EMAIL || 'admin@forum.com',
            password: adminPassword,
            role: 'admin',
            avatar: '🛡️',
            verified: true,
            banned: false,
            createdAt: new Date(),
            updatedAt: new Date(),
        },
        {
            name: 'Alex Student',
            email: 'alex@student.com',
            password: userPassword,
            role: 'student',
            avatar: '👨‍🎓',
            verified: false,
            banned: false,
            createdAt: new Date(),
            updatedAt: new Date(),
        },
        {
            name: 'Dr. Emma Wilson',
            email: 'emma@specialist.com',
            password: userPassword,
            role: 'specialist',
            avatar: '👩‍⚕️',
            profession: 'Psychologist',
            expertise: ['Anxiety', 'Mental Health', 'Productivity'],
            verified: true,
            banned: false,
            createdAt: new Date(),
            updatedAt: new Date(),
        },
        {
            name: 'Mark Johnson',
            email: 'mark@specialist.com',
            password: userPassword,
            role: 'specialist',
            avatar: '👨‍💼',
            profession: 'Corporate Strategist',
            expertise: ['Leadership', 'Startup Growth', 'Team Management'],
            verified: true,
            banned: false,
            createdAt: new Date(),
            updatedAt: new Date(),
        },
        {
            name: 'Sarah Lee',
            email: 'sarah@student.com',
            password: userPassword,
            role: 'student',
            avatar: '👩‍🎓',
            verified: false,
            banned: false,
            createdAt: new Date(),
            updatedAt: new Date(),
        },
        {
            name: 'Dr. Robert Kim',
            email: 'robert@specialist.com',
            password: userPassword,
            role: 'specialist',
            avatar: '👨‍⚕️',
            profession: 'Career Advisor',
            expertise: ['Interviews', 'Resume', 'Leadership'],
            verified: true,
            banned: false,
            createdAt: new Date(),
            updatedAt: new Date(),
        },
    ];

    const insertedUsers = await db.collection('users').insertMany(usersToCreate);
    const userIds = Object.values(insertedUsers.insertedIds).map(id => id.toString());
    console.log(`👤 Created ${userIds.length} users`);

    // Map: 0=admin, 1=alex, 2=emma, 3=mark, 4=sarah, 5=robert

    // ─── 3. Create Tags ───
    await db.collection('tags').insertMany(DEFAULT_TAGS);
    console.log(`🏷️  Created ${DEFAULT_TAGS.length} tags`);

    // ─── 4. Create Questions ───
    const questionsData = [
        {
            userId: userIds[1], // Alex
            title: 'How to manage stress during final exams?',
            description: 'I am finding it really difficult to manage my stress levels during my final exams. I often feel overwhelmed and anxious. What are some effective strategies to cope with exam stress?',
            tags: ['stress-management', 'mental-health'],
            views: 234,
            answerCount: 2,
            status: 'answered',
            removed: false,
            createdAt: new Date('2024-01-15T09:00:00Z'),
            updatedAt: new Date('2024-01-15T09:00:00Z'),
        },
        {
            userId: userIds[4], // Sarah
            title: 'Tips for preparing a strong resume for tech internships?',
            description: 'I am a sophomore looking for summer internships in software development. What should I include in my resume to make it stand out? I have done a few projects but no prior internship experience.',
            tags: ['resume', 'internship', 'software'],
            views: 189,
            answerCount: 1,
            status: 'answered',
            removed: false,
            createdAt: new Date('2024-01-16T08:30:00Z'),
            updatedAt: new Date('2024-01-16T08:30:00Z'),
        },
        {
            userId: userIds[1], // Alex
            title: 'How to stay motivated when working on long-term projects?',
            description: 'I often start projects with great enthusiasm but lose motivation halfway through. How can I maintain consistent motivation for long-term goals?',
            tags: ['motivation', 'productivity'],
            views: 67,
            answerCount: 0,
            status: 'pending',
            removed: false,
            createdAt: new Date('2024-01-17T14:00:00Z'),
            updatedAt: new Date('2024-01-17T14:00:00Z'),
        },
        {
            userId: userIds[4], // Sarah
            title: 'What are the key skills needed for a leadership role?',
            description: 'I recently got an opportunity to lead a team project at my university. I have never been in a leadership position before. What are the essential skills I should develop to be an effective leader?',
            tags: ['leadership', 'teamwork'],
            views: 156,
            answerCount: 2,
            status: 'answered',
            removed: false,
            createdAt: new Date('2024-01-18T08:00:00Z'),
            updatedAt: new Date('2024-01-18T08:00:00Z'),
        },
        {
            userId: userIds[4], // Sarah
            title: 'Best practices for technical interviews in AI/ML roles?',
            description: 'I have an upcoming interview for an AI/ML internship position. What kind of questions should I expect, and how should I prepare?',
            tags: ['interview', 'ai-ml'],
            views: 201,
            answerCount: 1,
            status: 'answered',
            removed: false,
            createdAt: new Date('2024-01-19T07:30:00Z'),
            updatedAt: new Date('2024-01-19T07:30:00Z'),
        },
        {
            userId: userIds[1], // Alex
            title: 'How to deal with imposter syndrome in academic settings?',
            description: "I constantly feel like I don't belong in my program, even though I have good grades. How do I overcome these feelings of inadequacy?",
            tags: ['mental-health', 'motivation'],
            views: 92,
            answerCount: 0,
            status: 'pending',
            removed: false,
            createdAt: new Date('2024-01-20T12:00:00Z'),
            updatedAt: new Date('2024-01-20T12:00:00Z'),
        },
        {
            userId: userIds[4], // Sarah
            title: 'Advice for joining a startup vs. established company?',
            description: 'I have offers from both a startup and a well-established tech company for my summer internship. What factors should I consider when making this decision?',
            tags: ['startup', 'internship'],
            views: 178,
            answerCount: 1,
            status: 'answered',
            removed: false,
            createdAt: new Date('2024-01-21T08:00:00Z'),
            updatedAt: new Date('2024-01-21T08:00:00Z'),
        },
        {
            userId: userIds[1], // Alex
            title: 'How to effectively communicate with team members in remote settings?',
            description: 'My team is working remotely on a group project, and we are facing communication challenges. How can we improve our remote collaboration?',
            tags: ['teamwork', 'productivity'],
            views: 45,
            answerCount: 0,
            status: 'pending',
            removed: false,
            createdAt: new Date('2024-01-22T10:00:00Z'),
            updatedAt: new Date('2024-01-22T10:00:00Z'),
        },
    ];

    const insertedQuestions = await db.collection('questions').insertMany(questionsData);
    const questionIds = Object.values(insertedQuestions.insertedIds).map(id => id.toString());
    console.log(`❓ Created ${questionIds.length} questions`);

    // ─── 5. Create Answers ───
    const answersData = [
        // Q1: stress management (2 answers)
        {
            questionId: questionIds[0],
            userId: userIds[2], // Dr. Emma
            content: "Start by creating a realistic study schedule that includes regular breaks. The Pomodoro Technique (25 minutes of focused study followed by 5-minute breaks) can be very effective. Also, make sure you're getting enough sleep, eating well, and exercising regularly. These physical factors significantly impact your mental resilience.",
            upvotes: 15,
            upvotedBy: [],
            isBest: true,
            removed: false,
            createdAt: new Date('2024-01-15T10:30:00Z'),
            updatedAt: new Date('2024-01-15T10:30:00Z'),
        },
        {
            questionId: questionIds[0],
            userId: userIds[5], // Dr. Robert
            content: 'Practice mindfulness and deep breathing exercises. When you feel overwhelmed, take 5 minutes to do some breathing exercises. This can help reset your nervous system and improve focus.',
            upvotes: 8,
            upvotedBy: [],
            isBest: false,
            removed: false,
            createdAt: new Date('2024-01-15T14:20:00Z'),
            updatedAt: new Date('2024-01-15T14:20:00Z'),
        },
        // Q2: resume tips (1 answer)
        {
            questionId: questionIds[1],
            userId: userIds[3], // Mark
            content: 'Focus on your projects! Include 3-4 strong projects with clear descriptions of what you built, the technologies you used, and the impact. Quantify whenever possible (e.g., "Built a web app that reduced processing time by 40%"). Also, make sure to include relevant coursework, technical skills, and any leadership positions in student organizations.',
            upvotes: 22,
            upvotedBy: [],
            isBest: true,
            removed: false,
            createdAt: new Date('2024-01-16T11:00:00Z'),
            updatedAt: new Date('2024-01-16T11:00:00Z'),
        },
        // Q4: leadership skills (2 answers)
        {
            questionId: questionIds[3],
            userId: userIds[3], // Mark
            content: "Communication is the foundation of good leadership. You need to be able to clearly articulate goals, expectations, and feedback. Also, develop active listening skills - understand your team members' perspectives and concerns. Delegation is equally important; trust your team and assign tasks based on individual strengths.",
            upvotes: 18,
            upvotedBy: [],
            isBest: false,
            removed: false,
            createdAt: new Date('2024-01-18T09:45:00Z'),
            updatedAt: new Date('2024-01-18T09:45:00Z'),
        },
        {
            questionId: questionIds[3],
            userId: userIds[5], // Dr. Robert
            content: "Be empathetic and lead by example. Show up on time, meet deadlines, and maintain a positive attitude. Your team will mirror your behavior. Also, don't be afraid to admit when you don't know something - it builds trust and encourages open communication.",
            upvotes: 14,
            upvotedBy: [],
            isBest: true,
            removed: false,
            createdAt: new Date('2024-01-18T11:20:00Z'),
            updatedAt: new Date('2024-01-18T11:20:00Z'),
        },
        // Q5: AI/ML interviews (1 answer)
        {
            questionId: questionIds[4],
            userId: userIds[3], // Mark
            content: 'Expect a mix of theoretical questions (machine learning algorithms, statistics, linear algebra) and practical coding challenges. Review fundamental ML algorithms like linear regression, decision trees, and neural networks. Be prepared to explain your project work in detail and discuss the trade-offs of different approaches.',
            upvotes: 25,
            upvotedBy: [],
            isBest: true,
            removed: false,
            createdAt: new Date('2024-01-19T10:15:00Z'),
            updatedAt: new Date('2024-01-19T10:15:00Z'),
        },
        // Q7: startup vs established (1 answer)
        {
            questionId: questionIds[6],
            userId: userIds[3], // Mark
            content: 'Both have pros and cons. Startups offer more hands-on experience, diverse responsibilities, and direct impact, but can be less structured with fewer resources. Established companies provide better mentorship, structured programs, and brand recognition, but your role might be more narrowly defined. Consider what you want to learn and which environment matches your working style.',
            upvotes: 19,
            upvotedBy: [],
            isBest: true,
            removed: false,
            createdAt: new Date('2024-01-21T09:30:00Z'),
            updatedAt: new Date('2024-01-21T09:30:00Z'),
        },
    ];

    await db.collection('answers').insertMany(answersData);
    console.log(`💬 Created ${answersData.length} answers`);

    // ─── Done ───
    console.log('\n✅ Database seeded successfully!');
    console.log('\n📋 Login Credentials:');
    console.log('──────────────────────────────────────');
    console.log(`  Admin:      ${process.env.ADMIN_EMAIL || 'admin@forum.com'} / ${process.env.ADMIN_PASSWORD || 'Admin@123'}`);
    console.log('  Student:    alex@student.com / Password@123');
    console.log('  Student:    sarah@student.com / Password@123');
    console.log('  Specialist: emma@specialist.com / Password@123');
    console.log('  Specialist: mark@specialist.com / Password@123');
    console.log('  Specialist: robert@specialist.com / Password@123');
    console.log('──────────────────────────────────────\n');

    await closeDB();
    process.exit(0);
}

seed().catch(err => {
    console.error('❌ Seed failed:', err);
    process.exit(1);
});
