// Généré par scripts/app/build-companions.py : ne pas modifier à la main.
// Positions des yeux en fraction (0 à 1) de l'image de la tête ; les humeurs sans yeux n'ont pas de pupille mobile.
export const COMPANION_ORDER = ["cat", "unicorn", "rabbit"];
export const COMPANIONS = {
  "cat": {
    "label": "Chat",
    "pupil": "assets/companions/cat/pupil.webp",
    "moods": {
      "idle": {
        "img": "assets/companions/cat/idle.webp",
        "eyes": [
          {
            "x": 0.3267,
            "y": 0.5402,
            "w": 0.1504,
            "h": 0.1914
          },
          {
            "x": 0.67,
            "y": 0.5402,
            "w": 0.1504,
            "h": 0.1914
          }
        ]
      },
      "happy": {
        "img": "assets/companions/cat/happy.webp"
      },
      "curious": {
        "img": "assets/companions/cat/curious.webp",
        "eyes": [
          {
            "x": 0.3335,
            "y": 0.5482,
            "w": 0.1523,
            "h": 0.1797
          },
          {
            "x": 0.6651,
            "y": 0.5481,
            "w": 0.1484,
            "h": 0.1797
          }
        ]
      },
      "worried": {
        "img": "assets/companions/cat/worried.webp",
        "eyes": [
          {
            "x": 0.3251,
            "y": 0.5507,
            "w": 0.1641,
            "h": 0.1992
          },
          {
            "x": 0.6726,
            "y": 0.5509,
            "w": 0.1641,
            "h": 0.1992
          }
        ]
      },
      "proud": {
        "img": "assets/companions/cat/proud.webp"
      },
      "sleepy": {
        "img": "assets/companions/cat/sleepy.webp"
      },
      "surprised": {
        "img": "assets/companions/cat/surprised.webp"
      }
    }
  },
  "unicorn": {
    "label": "Licorne",
    "pupil": "assets/companions/unicorn/pupil.webp",
    "moods": {
      "idle": {
        "img": "assets/companions/unicorn/idle.webp",
        "eyes": [
          {
            "x": 0.3536,
            "y": 0.6047,
            "w": 0.1387,
            "h": 0.168
          },
          {
            "x": 0.6488,
            "y": 0.6048,
            "w": 0.1367,
            "h": 0.168
          }
        ]
      },
      "happy": {
        "img": "assets/companions/unicorn/happy.webp"
      },
      "curious": {
        "img": "assets/companions/unicorn/curious.webp",
        "eyes": [
          {
            "x": 0.3562,
            "y": 0.5876,
            "w": 0.1406,
            "h": 0.1719
          },
          {
            "x": 0.6466,
            "y": 0.588,
            "w": 0.1426,
            "h": 0.1719
          }
        ]
      },
      "worried": {
        "img": "assets/companions/unicorn/worried.webp",
        "eyes": [
          {
            "x": 0.3621,
            "y": 0.6214,
            "w": 0.1328,
            "h": 0.166
          },
          {
            "x": 0.6392,
            "y": 0.6215,
            "w": 0.1328,
            "h": 0.166
          }
        ]
      },
      "proud": {
        "img": "assets/companions/unicorn/proud.webp"
      },
      "sleepy": {
        "img": "assets/companions/unicorn/sleepy.webp"
      },
      "surprised": {
        "img": "assets/companions/unicorn/surprised.webp"
      }
    },
    "horn": {
      "x": 0.5,
      "y": 0.0566
    }
  },
  "rabbit": {
    "label": "Lapin",
    "pupil": "assets/companions/rabbit/pupil.webp",
    "moods": {
      "idle": {
        "img": "assets/companions/rabbit/idle.webp",
        "eyes": [
          {
            "x": 0.3449,
            "y": 0.6724,
            "w": 0.1387,
            "h": 0.1484
          },
          {
            "x": 0.6511,
            "y": 0.6728,
            "w": 0.1387,
            "h": 0.1484
          }
        ]
      },
      "happy": {
        "img": "assets/companions/rabbit/happy.webp"
      },
      "curious": {
        "img": "assets/companions/rabbit/curious.webp",
        "eyes": [
          {
            "x": 0.3466,
            "y": 0.6781,
            "w": 0.1484,
            "h": 0.1543
          },
          {
            "x": 0.6283,
            "y": 0.6779,
            "w": 0.1484,
            "h": 0.1543
          }
        ]
      },
      "worried": {
        "img": "assets/companions/rabbit/worried.webp",
        "eyes": [
          {
            "x": 0.3658,
            "y": 0.5575,
            "w": 0.1309,
            "h": 0.1328
          },
          {
            "x": 0.6308,
            "y": 0.5576,
            "w": 0.1309,
            "h": 0.1328
          }
        ]
      },
      "proud": {
        "img": "assets/companions/rabbit/proud.webp"
      },
      "sleepy": {
        "img": "assets/companions/rabbit/sleepy.webp"
      },
      "surprised": {
        "img": "assets/companions/rabbit/surprised.webp"
      },
      "eat1": {
        "img": "assets/companions/rabbit/eat1.webp"
      },
      "eat2": {
        "img": "assets/companions/rabbit/eat2.webp"
      },
      "eat3": {
        "img": "assets/companions/rabbit/eat3.webp"
      }
    },
    "sprites": {
      "carrot": {
        "img": "assets/companions/rabbit/carrot.webp",
        "ratio": 0.506
      }
    }
  }
};
