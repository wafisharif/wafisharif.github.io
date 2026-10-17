/*
  Everything you'd want to edit lives in this file.
  Change the text, add a project, swap a link. main.js reads from here.
*/

const SITE = {
  name: "Wafi Sharif",
  firstName: "Wafi",
  intro:
    "Student in Queens, NY, working on movement analysis, machine learning, and physics education.",
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

/*
  visual: which little animation shows in the project viewer.
  Options: pose, gait, polar, battery, rbm, storm, pendulum, mri
*/
const PROJECTS = [
  {
    id: "kinetra",
    title: "Kinetra",
    kind: "App",
    status: "In TestFlight",
    year: "2026",
    visual: "pose",
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
    id: "gait",
    title: "Pathological gait stability",
    kind: "Research",
    status: "In progress",
    year: "2026",
    visual: "gait",
    summary: "Simulated walkers with gait impairments, then pushed to see who falls.",
    body: [
      "I'm building walking controllers in MuJoCo and MyoSuite for five groups: healthy adults and people with Parkinson's, Huntington's, ALS, and stroke. Each one is matched against real patient gait data from public datasets like GaitNDD and GaitPDB. Then I apply perturbations and compare how stable each controller stays.",
      "In a related study, I compared four walking policies on MyoSuite's leg model against real stroke motion capture data. The policy trained to imitate stroke gait developed a stiff-knee pattern on its own, with almost no knee bend on the affected side. That's a real clinical signature, and nothing in the training asked for it.",
      "I'm doing this with Miles Smith at MIT.",
    ],
    stack: ["Python", "MuJoCo", "MyoSuite", "Reinforcement learning"],
    links: [
      { label: "GitHub", url: "https://github.com/wafisharif/pathological-gait-stability" },
    ],
  },
  {
    id: "delor",
    title: "Polarization optics at Columbia",
    kind: "Lab",
    status: "Summer 2026",
    year: "2026",
    visual: "polar",
    summary: "A precision rotation mount and a polarization setup rebuilt from parts.",
    body: [
      "I spent the summer at the Delor Lab at Columbia, which does ultrafast optical imaging. My first job was putting a set of disassembled polarization optics back together, which meant figuring out which piece was a polarizer and which was a half-wave plate by checking transmitted intensity against Malus's law.",
      "The main project was designing a rotation mount for angle-resolved measurements on anisotropic materials, to be tested on the kind of material behind the lab's work on hyperbolic chiral polaritons. I also worked on a modular iSCAT microscope and a 3D-printed sample stage designed to stay very still.",
      "My mentor was Agata Azzolini.",
    ],
    stack: ["Polarization optics", "iSCAT", "CAD", "3D printing"],
    links: [],
  },
  {
    id: "battery",
    title: "Battery binder chemistry",
    kind: "Research",
    status: "Paper submitted",
    year: "",
    visual: "battery",
    summary: "How a lithium-substituted binder changes resistance inside a graphite anode.",
    body: [
      "At NYU Tandon, through the ARISE program, I worked in Andre Taylor's lab on the binder that holds a graphite anode together. I studied how moving toward a lithium-substituted version of CMC, a more sustainable binder, changes the charge transfer resistance at the electrode interface.",
      "The paper is submitted to Royal Society Open Science, and the raw data is public on Zenodo.",
    ],
    stack: ["Electrochemistry", "Impedance spectroscopy", "Data analysis"],
    links: [{ label: "Data on Zenodo", url: "https://doi.org/10.5281/zenodo.21210104" }],
  },
  {
    id: "rtrbm",
    title: "Temporal RBMs for Learnergy",
    kind: "ML",
    status: "In progress",
    year: "2026",
    visual: "rbm",
    summary: "Teaching an energy-based model library to learn from sequences.",
    body: [
      "Learnergy is an open-source library for energy-based models. I'm adding a recurrent temporal restricted Boltzmann machine (RTRBM) and a stacked version of it (RTDBN), so the library can learn from sequences instead of single snapshots.",
      "I've been testing it on biomechanical movement data. The plan is to plug it into SIT-FUSE, a framework at Spatial Informatics Group, where I'm working with Nick LaHaye.",
    ],
    stack: ["Python", "PyTorch", "Energy-based models"],
    links: [],
  },
  {
    id: "stormsurge",
    title: "StormSurge",
    kind: "ML",
    status: "Hackathon",
    year: "2026",
    visual: "storm",
    summary: "Forecasting upper-atmosphere density during big geomagnetic storms.",
    body: [
      "StormSurge is a physics-constrained machine learning model for thermospheric density during extreme geomagnetic storms. Density up there decides how much drag satellites feel, and it jumps during storms, which is exactly when it's hardest to predict.",
      "I built it for the NASA and Hack Club Stardance challenge.",
    ],
    stack: ["Python", "Machine learning", "Space weather data"],
    links: [],
  },
  {
    id: "studiophysics",
    title: "Studio Physics",
    kind: "Physics",
    status: "Live",
    year: "",
    visual: "pendulum",
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
  {
    id: "rsna",
    title: "Knee MRI abnormality detection",
    kind: "ML",
    status: "In progress",
    year: "2026",
    visual: "mri",
    summary: "A Kaggle entry for spotting abnormalities in knee MRI scans.",
    body: [
      "I'm competing in the RSNA knee abnormality detection challenge on Kaggle, training models on knee MRI scans with Kaggle's notebook GPUs.",
      "It's still early. I'll put results here once there's something worth showing.",
    ],
    stack: ["Python", "PyTorch", "Medical imaging", "Kaggle"],
    links: [],
  },
];

const EXPERIENCE = [
  {
    where: "Columbia University, Delor Lab",
    what: "Summer research intern in ultrafast optical imaging. Polarization optics, a rotation mount for anisotropic samples, and iSCAT.",
    when: "Summer 2026",
    project: "delor",
  },
  {
    where: "MIT, with Miles Smith",
    what: "Research on musculoskeletal walking simulations and how stable impaired gaits are under perturbation.",
    when: "2026",
    project: "gait",
  },
  {
    where: "Spatial Informatics Group, with Nick LaHaye",
    what: "Adding temporal RBMs to the Learnergy library for use in the SIT-FUSE framework.",
    when: "2026",
    project: "rtrbm",
  },
  {
    where: "NYU Tandon, ARISE",
    what: "Battery materials research in Andre Taylor's lab on binder chemistry for graphite anodes.",
    when: "",
    project: "battery",
  },
  {
    where: "NASA and Hack Club Stardance",
    what: "Built StormSurge, a physics-constrained model for thermospheric density during geomagnetic storms.",
    when: "",
    project: "stormsurge",
  },
];

const PAPERS = [
  {
    title:
      "Modulating Interfacial Charge Transfer Resistance in Graphite Anodes through Sustainable Binder Chemistry: Toward Li-Substituted CMC Design",
    note: "Submitted to Royal Society Open Science",
    url: "https://doi.org/10.5281/zenodo.21210104",
    urlLabel: "Dataset",
  },
  {
    title:
      "Validating Musculoskeletal Locomotion Policies Against Real Gait Data: Reward-Design Trade-offs and an Emergent Stiff-Knee Gait Signature",
    note: "Manuscript, with Miles Smith",
    url: "",
    urlLabel: "",
  },
];

const ABOUT = {
  paragraphs: [
    "I'm Wafi, a student at Queens High School for the Sciences in Jamaica, Queens.",
    "A lot of what I work on comes back to one question: how do you measure the way a body moves, and what can you actually learn from it? That's where Kinetra came from, and the gait simulations, and the temporal models I'm building for movement data.",
    "The rest of the time I'm usually doing physics you can see. That's why I started Studio Physics, and how I ended up in an optics lab at Columbia this summer after doing battery chemistry at NYU before that. I'm also working through Gilbert Strang's linear algebra course on my own.",
  ],
  now: [
    "Getting Kinetra from TestFlight onto the App Store",
    "Running perturbation experiments for the gait project",
    "Training models for the RSNA knee MRI challenge",
    "Making new Manim reels for Studio Physics",
    "MIT 18.06, one lecture at a time",
  ],
  tools: [
    { group: "Languages", items: ["Python", "TypeScript", "JavaScript", "HTML and CSS"] },
    { group: "ML and data", items: ["PyTorch", "MediaPipe", "OpenCV", "Kaggle"] },
    { group: "Simulation", items: ["MuJoCo", "MyoSuite", "Manim", "p5.js"] },
    { group: "Apps and web", items: ["React Native", "Expo", "Flask", "Render", "GitHub Actions"] },
    { group: "Lab", items: ["Polarization optics", "iSCAT", "3D printing", "Electrochemistry"] },
  ],
};
