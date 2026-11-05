/*
  Everything you'd want to edit lives in this file.
  Change the text, add a project, swap a link. main.js reads from here.
*/

const SITE = {
  name: "Wafi Sharif",
  firstName: "Wafi",
  intro: "Student in Queens, NY. Interested in biomechanics, computation, and engineering.",
  email: "wafi@kinetraapp.com",
  github: "https://github.com/wafisharif",
  githubHandle: "wafisharif",
  // Leave a url as "" to hide that link everywhere on the site.
  links: [
    { label: "GitHub", url: "https://github.com/wafisharif" },
    { label: "Studio Physics", url: "https://studiophysics.com" },
    { label: "Kinetra", url: "https://kinetraapp.com" },
    { label: "Instagram", url: "https://instagram.com/studiophysics" },
    { label: "LinkedIn", url: "" },
  ],
};

const PROJECTS = [
  {
    id: "kinetra",
    title: "Kinetra",
    kind: "App",
    status: "In TestFlight",
    year: "2026",
    summary: "A phone app that scores how you move from a short video.",
    body: [
      "Kinetra takes a video from your phone camera, runs pose estimation on it, and gives back joint angles, rep counts, and scores for smoothness, symmetry, and control. There are separate modes for sit-to-stand, reaching, arm raises, walking, balance, and the timed up-and-go test that physical therapists use a lot.",
      "There's also a daily check-in that takes about 30 seconds and doesn't need the camera at all. Over time the app lines up how sore you said you were with your recorded scores, and it points out patterns, like one side scoring lower than the other.",
      "The app is built with Expo and React Native. The analysis runs on a Flask server with MediaPipe, hosted on Render. The first iOS build is in TestFlight right now.",
    ],
    stack: ["React Native", "Expo", "TypeScript", "Flask", "MediaPipe", "OpenCV", "Playwright"],
    links: [{ label: "kinetraapp.com", url: "https://kinetraapp.com" }],
  },
  {
    id: "rtrbm",
    title: "Temporal RBMs for Learnergy",
    kind: "ML",
    status: "In progress",
    year: "2026",
    summary: "Adding sequence models to an energy-based learning library, for use in SIT-FUSE.",
    body: [
      "Learnergy is an open-source Python library for energy-based models like restricted Boltzmann machines. I'm adding a recurrent temporal RBM (RTRBM) and a stacked version of it (RTDBN), so the library can learn from data that changes over time instead of treating each sample on its own.",
      "These models are meant to be used in SIT-FUSE, a self-supervised framework from NASA JPL for finding and tracking things like wildfire smoke, dust plumes, and harmful algal blooms in satellite and airborne imagery. SIT-FUSE is designed to work when there are few or no labels, and it follows objects across scenes over time. A model that learns how a scene changes from one frame to the next fits that kind of tracking well.",
      "I've also been testing the models on biomechanical movement data. I'm working on this with Nick LaHaye at Spatial Informatics Group.",
    ],
    stack: ["Python", "PyTorch", "Energy-based models"],
    links: [],
  },
  {
    id: "studiophysics",
    title: "Studio Physics",
    kind: "Physics",
    status: "Live",
    year: "",
    summary: "An AP Physics 1 site with interactive simulators, plus animated explainers.",
    body: [
      "Studio Physics started as a study guide for AP Physics 1 and turned into a full site: seven unit pages and a set of interactive simulators built with p5.js, all sharing one dark visual style.",
      "I also make short physics animations with Manim for Instagram, on things like the Dzhanibekov effect, the falling slinky, and why a double pendulum is chaotic.",
    ],
    stack: ["HTML", "CSS", "JavaScript", "p5.js", "Manim"],
    links: [
      { label: "studiophysics.com", url: "https://studiophysics.com" },
      { label: "Instagram", url: "https://instagram.com/studiophysics" },
    ],
  },
];

const ABOUT = {
  paragraphs: [
    "I'm Wafi, a high school student at Queens High School for the Sciences in Jamaica, Queens.",
    "I'm most interested in how the body moves and how you can measure and model that movement. That pulls me toward biomechanics, and toward the math and programming that make it possible to study. I like engineering and physics more broadly too, especially when I can build something and watch an idea actually work.",
    "I spend a lot of my free time teaching myself new things. Lately that's been linear algebra, through Gilbert Strang's lectures from MIT. I also like reading about how startups and markets work.",
  ],
  tools: [
    { group: "Languages", items: ["Python", "TypeScript", "JavaScript", "HTML and CSS"] },
    { group: "ML and data", items: ["PyTorch", "MediaPipe", "OpenCV", "Kaggle"] },
    { group: "Simulation", items: ["MuJoCo", "MyoSuite", "Manim", "p5.js"] },
    { group: "Apps and web", items: ["React Native", "Expo", "Flask", "Render", "GitHub Actions"] },
    { group: "Lab", items: ["Polarization optics", "iSCAT", "3D printing", "Electrochemistry"] },
  ],
};
