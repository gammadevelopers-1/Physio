// Script to create a new blog post and update featured status
// Run with: npx tsx scripts/create-physio-blog.ts

import { createClient } from "@sanity/client";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), ".env.local") });

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET || "production";
const token = process.env.SANITY_API_TOKEN;

if (!projectId || !token) {
    console.error("Missing NEXT_PUBLIC_SANITY_PROJECT_ID or SANITY_API_TOKEN");
    process.exit(1);
}

const client = createClient({
    projectId,
    dataset,
    apiVersion: "2024-01-01",
    token,
    useCdn: false,
});

async function createBlogPost() {
    try {
        console.log("🚀 Starting blog post creation...\n");

        // Step 1: Create or get the category
        console.log("📁 Creating/updating category...");
        const category = await client.createOrReplace({
            _id: "category-physiotherapy",
            _type: "category",
            title: {
                en: "Physiotherapy",
                ar: "العلاج الطبيعي"
            },
            slug: {
                _type: "slug",
                current: "physiotherapy"
            }
        });
        console.log("✅ Category created:", category._id);

        // Step 2: Set old blog posts to NOT featured
        console.log("\n🔄 Updating old blog posts to not featured...");
        const oldPosts = await client.fetch(`*[_type == "blogPost" && featured == true]{ _id }`);
        for (const post of oldPosts) {
            await client.patch(post._id).set({ featured: false }).commit();
            console.log(`   Updated ${post._id} to not featured`);
        }

        // Step 3: Upload new image
        console.log("\n📤 Uploading image to Sanity...");
        const imagePath = "/tmp/physio-guidance-image.jpg";
        const imageBuffer = fs.readFileSync(imagePath);

        const imageAsset = await client.assets.upload("image", imageBuffer, {
            filename: "importance-of-physio-guidance.jpg",
            contentType: "image/jpeg"
        });
        console.log("✅ Image uploaded:", imageAsset._id);

        // Step 4: Create the new featured blog post
        console.log("\n📝 Creating new featured blog post...");
        const blogPost = await client.create({
            _type: "blogPost",
            title: {
                en: "Importance of Physio Guidance",
                ar: "أهمية التوجيه في العلاج الطبيعي"
            },
            slug: {
                _type: "slug",
                current: "importance-of-physio-guidance"
            },
            excerpt: {
                en: "Discover why professional physiotherapy guidance is essential for effective rehabilitation, injury prevention, and maintaining optimal physical health throughout your life.",
                ar: "اكتشف لماذا يعتبر التوجيه المهني في العلاج الطبيعي ضرورياً لإعادة التأهيل الفعال والوقاية من الإصابات والحفاظ على الصحة البدنية المثلى طوال حياتك."
            },
            content: {
                en: [
                    {
                        _type: "block",
                        _key: "intro1",
                        style: "normal",
                        children: [
                            {
                                _type: "span",
                                _key: "span1",
                                text: "Physiotherapy, also known as physical therapy, is a healthcare profession dedicated to helping people restore, maintain, and maximize their physical strength, function, and overall well-being. Professional physiotherapy guidance plays a crucial role in helping individuals recover from injuries, manage chronic conditions, and prevent future health problems."
                            }
                        ],
                        markDefs: []
                    },
                    {
                        _type: "block",
                        _key: "heading1",
                        style: "h2",
                        children: [
                            {
                                _type: "span",
                                _key: "span2",
                                text: "Why Professional Guidance Matters"
                            }
                        ],
                        markDefs: []
                    },
                    {
                        _type: "block",
                        _key: "para2",
                        style: "normal",
                        children: [
                            {
                                _type: "span",
                                _key: "span3",
                                text: "While it may be tempting to follow generic exercise videos or advice from the internet, working with a qualified physiotherapist ensures that your treatment plan is tailored specifically to your needs. A professional can accurately assess your condition, identify underlying issues, and design a personalized program that addresses your unique challenges while considering your lifestyle and goals."
                            }
                        ],
                        markDefs: []
                    },
                    {
                        _type: "block",
                        _key: "heading2",
                        style: "h2",
                        children: [
                            {
                                _type: "span",
                                _key: "span4",
                                text: "Benefits of Physiotherapy Guidance"
                            }
                        ],
                        markDefs: []
                    },
                    {
                        _type: "block",
                        _key: "para3",
                        style: "normal",
                        children: [
                            {
                                _type: "span",
                                _key: "span5",
                                text: "Professional physiotherapy offers numerous benefits including accelerated recovery from injuries and surgeries, effective pain management without relying solely on medication, improved mobility and flexibility, enhanced strength and endurance, and better posture and body mechanics. Additionally, physiotherapists can help prevent future injuries by identifying and addressing biomechanical issues before they become serious problems."
                            }
                        ],
                        markDefs: []
                    },
                    {
                        _type: "block",
                        _key: "heading3",
                        style: "h2",
                        children: [
                            {
                                _type: "span",
                                _key: "span6",
                                text: "Personalized Treatment Plans"
                            }
                        ],
                        markDefs: []
                    },
                    {
                        _type: "block",
                        _key: "para4",
                        style: "normal",
                        children: [
                            {
                                _type: "span",
                                _key: "span7",
                                text: "One of the greatest advantages of working with a physiotherapist is receiving a customized treatment plan. Your therapist will consider factors such as your age, fitness level, medical history, and specific goals when designing your program. This personalized approach ensures that you receive the most effective treatment while minimizing the risk of further injury or complications."
                            }
                        ],
                        markDefs: []
                    },
                    {
                        _type: "block",
                        _key: "heading4",
                        style: "h2",
                        children: [
                            {
                                _type: "span",
                                _key: "span8",
                                text: "Long-term Health Investment"
                            }
                        ],
                        markDefs: []
                    },
                    {
                        _type: "block",
                        _key: "conclusion",
                        style: "normal",
                        children: [
                            {
                                _type: "span",
                                _key: "span9",
                                text: "Investing in professional physiotherapy guidance is an investment in your long-term health. By working with qualified professionals, you can achieve better outcomes, recover faster, and develop the knowledge and skills needed to maintain your physical health for years to come. Whether you're recovering from an injury, managing a chronic condition, or simply looking to improve your physical performance, physiotherapy guidance can help you reach your goals safely and effectively."
                            }
                        ],
                        markDefs: []
                    }
                ],
                ar: [
                    {
                        _type: "block",
                        _key: "intro1-ar",
                        style: "normal",
                        children: [
                            {
                                _type: "span",
                                _key: "span1-ar",
                                text: "العلاج الطبيعي هو مهنة رعاية صحية مكرسة لمساعدة الناس على استعادة قوتهم البدنية ووظائفهم ورفاهيتهم العامة والحفاظ عليها وزيادتها إلى أقصى حد. يلعب التوجيه المهني في العلاج الطبيعي دوراً حاسماً في مساعدة الأفراد على التعافي من الإصابات وإدارة الحالات المزمنة ومنع المشاكل الصحية المستقبلية."
                            }
                        ],
                        markDefs: []
                    },
                    {
                        _type: "block",
                        _key: "heading1-ar",
                        style: "h2",
                        children: [
                            {
                                _type: "span",
                                _key: "span2-ar",
                                text: "لماذا يهم التوجيه المهني"
                            }
                        ],
                        markDefs: []
                    },
                    {
                        _type: "block",
                        _key: "para2-ar",
                        style: "normal",
                        children: [
                            {
                                _type: "span",
                                _key: "span3-ar",
                                text: "في حين أنه قد يكون من المغري متابعة مقاطع فيديو التمارين العامة أو النصائح من الإنترنت، فإن العمل مع أخصائي علاج طبيعي مؤهل يضمن أن خطة العلاج الخاصة بك مصممة خصيصاً لاحتياجاتك. يمكن للمختص تقييم حالتك بدقة وتحديد المشاكل الكامنة وتصميم برنامج شخصي يعالج تحدياتك الفريدة مع مراعاة نمط حياتك وأهدافك."
                            }
                        ],
                        markDefs: []
                    },
                    {
                        _type: "block",
                        _key: "heading2-ar",
                        style: "h2",
                        children: [
                            {
                                _type: "span",
                                _key: "span4-ar",
                                text: "فوائد توجيه العلاج الطبيعي"
                            }
                        ],
                        markDefs: []
                    },
                    {
                        _type: "block",
                        _key: "para3-ar",
                        style: "normal",
                        children: [
                            {
                                _type: "span",
                                _key: "span5-ar",
                                text: "يقدم العلاج الطبيعي المهني فوائد عديدة بما في ذلك التعافي المتسارع من الإصابات والجراحات، وإدارة الألم الفعالة دون الاعتماد فقط على الأدوية، وتحسين الحركة والمرونة، وتعزيز القوة والتحمل، وتحسين وضعية الجسم وميكانيكيته. بالإضافة إلى ذلك، يمكن لأخصائيي العلاج الطبيعي المساعدة في منع الإصابات المستقبلية من خلال تحديد ومعالجة المشاكل الميكانيكية الحيوية قبل أن تصبح مشاكل خطيرة."
                            }
                        ],
                        markDefs: []
                    },
                    {
                        _type: "block",
                        _key: "heading3-ar",
                        style: "h2",
                        children: [
                            {
                                _type: "span",
                                _key: "span6-ar",
                                text: "خطط العلاج الشخصية"
                            }
                        ],
                        markDefs: []
                    },
                    {
                        _type: "block",
                        _key: "para4-ar",
                        style: "normal",
                        children: [
                            {
                                _type: "span",
                                _key: "span7-ar",
                                text: "من أكبر مزايا العمل مع أخصائي العلاج الطبيعي هو الحصول على خطة علاج مخصصة. سيأخذ المعالج الخاص بك في الاعتبار عوامل مثل عمرك ومستوى لياقتك وتاريخك الطبي وأهدافك المحددة عند تصميم برنامجك. يضمن هذا النهج الشخصي حصولك على العلاج الأكثر فعالية مع تقليل خطر الإصابة أو المضاعفات الإضافية."
                            }
                        ],
                        markDefs: []
                    },
                    {
                        _type: "block",
                        _key: "heading4-ar",
                        style: "h2",
                        children: [
                            {
                                _type: "span",
                                _key: "span8-ar",
                                text: "استثمار في الصحة على المدى الطويل"
                            }
                        ],
                        markDefs: []
                    },
                    {
                        _type: "block",
                        _key: "conclusion-ar",
                        style: "normal",
                        children: [
                            {
                                _type: "span",
                                _key: "span9-ar",
                                text: "الاستثمار في التوجيه المهني للعلاج الطبيعي هو استثمار في صحتك على المدى الطويل. من خلال العمل مع محترفين مؤهلين، يمكنك تحقيق نتائج أفضل والتعافي بشكل أسرع وتطوير المعرفة والمهارات اللازمة للحفاظ على صحتك البدنية لسنوات قادمة. سواء كنت تتعافى من إصابة أو تدير حالة مزمنة أو ببساطة تتطلع إلى تحسين أدائك البدني، يمكن لتوجيه العلاج الطبيعي مساعدتك في الوصول إلى أهدافك بأمان وفعالية."
                            }
                        ],
                        markDefs: []
                    }
                ]
            },
            mainImage: {
                _type: "image",
                asset: {
                    _type: "reference",
                    _ref: imageAsset._id
                },
                alt: "Professional physiotherapy guidance session"
            },
            category: {
                _type: "reference",
                _ref: category._id
            },
            publishedAt: new Date().toISOString(),
            readTimeMinutes: 6,
            featured: true,
            author: {
                name: {
                    en: "PhysioGuidance Team",
                    ar: "فريق فيزيو جايدنس"
                }
            },
            tags: ["Physiotherapy", "Health", "Rehabilitation", "Wellness"]
        });

        console.log("✅ Blog post created:", blogPost._id);
        console.log("\n🎉 Success! New featured blog post has been published.");
        console.log(`\n📖 View at: http://localhost:3000/en/blogs/${blogPost.slug.current}`);

        // Show all blog posts
        console.log("\n📋 Current blog posts:");
        const allPosts = await client.fetch(`*[_type == "blogPost"]{ _id, title, featured }`);
        allPosts.forEach((post: any) => {
            console.log(`   ${post.featured ? '⭐ Featured:' : '  -'} ${post.title.en}`);
        });

    } catch (error) {
        console.error("❌ Error creating blog post:", error);
        process.exit(1);
    }
}

createBlogPost();
