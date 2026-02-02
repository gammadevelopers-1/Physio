// Script to create a blog post in Sanity
// Run with: npx tsx scripts/create-blog-post.ts

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

        // Step 1: Create category first
        console.log("📁 Creating category...");
        const category = await client.createOrReplace({
            _id: "category-medical-education",
            _type: "category",
            title: {
                en: "Medical Education",
                ar: "التعليم الطبي"
            },
            slug: {
                _type: "slug",
                current: "medical-education"
            }
        });
        console.log("✅ Category created:", category._id);

        // Step 2: Upload image from local file
        console.log("\n📤 Uploading image to Sanity...");
        const imagePath = "/tmp/medical-blog-image.jpg";
        const imageBuffer = fs.readFileSync(imagePath);

        const imageAsset = await client.assets.upload("image", imageBuffer, {
            filename: "medical-insurgencies-hero.jpg",
            contentType: "image/jpeg"
        });
        console.log("✅ Image uploaded:", imageAsset._id);

        // Step 3: Create the blog post
        console.log("\n📝 Creating blog post...");
        const blogPost = await client.create({
            _type: "blogPost",
            title: {
                en: "True Definitions of Medical Insurgencies",
                ar: "التعريفات الحقيقية للطوارئ الطبية"
            },
            slug: {
                _type: "slug",
                current: "true-definitions-of-medical-insurgencies"
            },
            excerpt: {
                en: "Understanding the critical concepts and definitions that shape medical emergency response and healthcare crisis management in modern healthcare systems.",
                ar: "فهم المفاهيم والتعريفات الحاسمة التي تشكل الاستجابة للطوارئ الطبية وإدارة الأزمات الصحية في أنظمة الرعاية الصحية الحديثة."
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
                                text: "Medical insurgencies represent critical situations that demand immediate attention and specialized knowledge. In the healthcare sector, understanding these scenarios is essential for both medical professionals and the general public."
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
                                text: "What Are Medical Insurgencies?"
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
                                text: "Medical insurgencies refer to sudden, unexpected medical situations that require rapid response and intervention. These can range from individual medical emergencies to large-scale public health crises. The key characteristic of such situations is their urgency and the potential for significant harm if not addressed promptly and effectively."
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
                                text: "Categories of Medical Emergencies"
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
                                text: "Medical emergencies can be categorized into several types: cardiac emergencies including heart attacks and cardiac arrest, respiratory emergencies such as severe asthma attacks or respiratory failure, neurological emergencies including strokes and seizures, and trauma emergencies resulting from accidents or injuries."
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
                                text: "The Importance of Preparedness"
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
                                text: "Healthcare organizations must maintain robust emergency response protocols. This includes regular training for medical staff, well-maintained equipment, and clear communication channels. Community awareness and basic first aid knowledge among the general population also play crucial roles in emergency response effectiveness."
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
                                _key: "span8",
                                text: "Understanding medical insurgencies and being prepared to respond appropriately can make the difference between life and death. Healthcare education and continuous professional development remain the cornerstones of effective emergency medical care."
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
                                text: "تمثل الطوارئ الطبية حالات حرجة تتطلب اهتماماً فورياً ومعرفة متخصصة. في قطاع الرعاية الصحية، يعد فهم هذه السيناريوهات أمراً ضرورياً لكل من المتخصصين الطبيين وعامة الناس."
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
                                text: "ما هي الطوارئ الطبية؟"
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
                                text: "تشير الطوارئ الطبية إلى المواقف الطبية المفاجئة وغير المتوقعة التي تتطلب استجابة وتدخلاً سريعاً. يمكن أن تتراوح هذه من حالات الطوارئ الطبية الفردية إلى أزمات الصحة العامة واسعة النطاق. السمة الرئيسية لمثل هذه المواقف هي إلحاحها واحتمالية حدوث ضرر كبير إذا لم تتم معالجتها بسرعة وفعالية."
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
                                text: "فئات حالات الطوارئ الطبية"
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
                                text: "يمكن تصنيف حالات الطوارئ الطبية إلى عدة أنواع: حالات طوارئ القلب بما في ذلك النوبات القلبية والسكتة القلبية، وحالات طوارئ الجهاز التنفسي مثل نوبات الربو الحادة أو الفشل التنفسي، وحالات الطوارئ العصبية بما في ذلك السكتات الدماغية والنوبات، وحالات طوارئ الصدمات الناتجة عن الحوادث أو الإصابات."
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
                                text: "أهمية الاستعداد"
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
                                text: "يجب على منظمات الرعاية الصحية الحفاظ على بروتوكولات قوية للاستجابة للطوارئ. يشمل ذلك التدريب المنتظم للطاقم الطبي، والمعدات المصانة جيداً، وقنوات الاتصال الواضحة. كما يلعب الوعي المجتمعي ومعرفة الإسعافات الأولية الأساسية بين عامة السكان أدواراً حاسمة في فعالية الاستجابة للطوارئ."
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
                                _key: "span8-ar",
                                text: "إن فهم الطوارئ الطبية والاستعداد للاستجابة بشكل مناسب يمكن أن يحدث فرقاً بين الحياة والموت. يظل التعليم الصحي والتطوير المهني المستمر حجر الزاوية في الرعاية الطبية الطارئة الفعالة."
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
                alt: "Medical emergency response team"
            },
            category: {
                _type: "reference",
                _ref: category._id
            },
            publishedAt: new Date().toISOString(),
            readTimeMinutes: 5,
            featured: true,
            author: {
                name: {
                    en: "Dr. Sarah Ahmed",
                    ar: "د. سارة أحمد"
                }
            }
        });

        console.log("✅ Blog post created:", blogPost._id);
        console.log("\n🎉 Success! Blog post has been published.");
        console.log(`\n📖 View at: http://localhost:3000/en/blogs/${blogPost.slug.current}`);

    } catch (error) {
        console.error("❌ Error creating blog post:", error);
        process.exit(1);
    }
}

createBlogPost();
