import React, { useMemo } from "react";
import {
  getContainerStyle,
  getWrapperStyle,
  getBackgroundStyle,
  getNoiseTextureStyle,
  getScrollingBackgroundsStyle,
  getMenuStyle,
  getInnerContainerStyle,
  getSectionsContainerStyle,
  getSecondCardStyle,
  getSectionWrapperStyle,
  getFirstSectionColorBackgroundStyle,
  getSecondSectionColorBackgroundStyle,
  getSectionContentStyle,
  getBlackBorderWrapper,
  getBlackBorderInnerWrapper
} from "./HomeScreen.styles.js";
import {
  ChatAnimation,
  DraggableCard,
  DraggableSection,
  VibesSwitch
} from "../../components/index.ts";
import { HomeScreenProps } from "./HomeScreen.types.ts";
import { useIsMobile } from "../../hooks/index.ts";

export const HomeScreen = ({}: HomeScreenProps) => {
  const isMobile = useIsMobile();

  // 🧩 Define your 3 chat scenarios
  const scenarios = [
    {
      title: `JChris named the conversation "Friendsgiving 2: Mac n Cheese Redemption"`,
      arrayOfMessages: [
        { user: "JChris", message: "Who’s coming to Friendsgiving this year?" },
        { user: "Megan", message: "yes please rescue me from my family 🥲" },
        { user: "JChris", message: "can we not repeat last year’s mac n cheese disaster tho" },
        { user: "Megan", message: "I’m still recovering!" },
        { user: "Mike", message: "Should I make a spreadsheet?" },
        { user: "Megan", message: "Zzzzzzzzz" },
        { user: "You", message: "buds I got this!" },
        { user: "You", message: "lemme just make us a festive lil app:" },
        { user: "You", message: "https://bright-shango-4087.vibesdiy.app/" },
        { user: "JChris", message: "nice! dibs on the mac" },
        { user: "Marcus", message: "I’m a *coder* now\n*tries Vibes DIY once* 🤓" }
      ],
    },
    {
      title: `Roomies`,
      arrayOfMessages: [
        { user: "James", message: "sorry roomies, I didn’t have time to tackle Dish Mountain last night" },
        { user: "James", message: "will absolutely get to it after work" },
        { user: "Lola", message: "Pretty sure it’s my turn, no?" },
        { user: "Jordan", message: "Huge if true!!" },
        { user: "James", message: "@Lola if you do the dishes I’ll take out the trash tomorrow AM!" },
        { user: "You", message: "ok hear me out:" },
        { user: "You", message: "chore chart, but make it fun?" },
        { user: "You", message: "https://coltrane-oshun-9477.vibesdiy.app/" },
        { user: "Jordan", message: "Did we just…solve dishes?" },
        { user: "James", message: "Chore quest!!!" }
      ],
    },
    {
      title: `Trivia Night`,
      arrayOfMessages: [
        { user: "Bobby", message: "never felt dumber than last night 🥲" },
        { user: "Bobby", message: "they should make trivia night for people with brainrot" },
        { user: "You", message: "“I’ll take Real Housewives of SLC for $500, Alex!”" },
        { user: "Lindsay", message: "Bravo Brainteasters lol" },
        { user: "Nikki", message: "to be fair, the reality TV lore is deeeeeep" },
        { user: "Lindsay", message: "actually I’d probably watch that" },
        { user: "Bobby", message: "imagine Andy Cohen as a host" },
        { user: "You", message: "I kinda think you might have something with this:\nhttps://chromatic-fader-4248.vibesdiy.app/" },
        { user: "Bobby", message: "oh it’s so over for all of you!!!!" }
      ],
    },
  ];

  // 🎲 Pick one scenario at random on each render
  const selectedScenario = useMemo(
    () => scenarios[Math.floor(Math.random() * scenarios.length)],
    [] // empty deps = pick once per mount
  );

  return (
    <div style={getBlackBorderWrapper()}>
      <div style={getBackgroundStyle()} />
      <div style={getNoiseTextureStyle()} />
    <div style={getBlackBorderInnerWrapper()}>
      <div style={getMenuStyle()}>
        <VibesSwitch size={64} />
      </div>


      <div style={getScrollingBackgroundsStyle()}>
        <div style={getFirstSectionColorBackgroundStyle(isMobile)} />
        <div style={getSecondSectionColorBackgroundStyle(isMobile)} />
      </div>

      <div style={getWrapperStyle()} />

      <div style={getContainerStyle()}>
        <div style={getInnerContainerStyle(isMobile)}>
          <DraggableSection color="grey" x={20} y={20}>
              <h2 style={{ fontWeight: "bold", fontSize: "40px" }}>
                Impress the Group Chat
              </h2>
              <p style={{ fontWeight: "bold" }}>
                Instantly make your own apps on the fly
              </p>
            </DraggableSection>

            <DraggableSection color="blue" x={20} y={170}>
              <ChatAnimation
                title={selectedScenario.title}
                arrayOfMessages={selectedScenario.arrayOfMessages}
                user={"You"}
              />
            </DraggableSection>

            <DraggableCard color="blue" x={550} y={100}>
              <p style={{ maxWidth: "250px", fontWeight: "bold" }}>
                No coding experience required. Just build what you need, when
                you need it, and share it instantly with the group chat.
              </p>
            </DraggableCard>

            <DraggableCard color="grey" x={870} y={100}>
              <img
                src="https://www.pngfind.com/pngs/m/2-24642_imagenes-random-png-cosas-random-png-transparent-png.png"
                style={{ width: "150px" }}
              />
            </DraggableCard>

            <DraggableCard color="yellow" x={800} y={20}>
              <p style={{ fontWeight: "bold" }}>No app store. No downloads.</p>
            </DraggableCard>

            <DraggableCard color="red" x={800} y={320}>
              <p style={{ maxWidth: "200px", fontWeight: "bold" }}>
                Custom community apps. Made by and for your friends, for
                everything you do together.
              </p>
            </DraggableCard>
          </div>

          <div style={getSectionsContainerStyle(isMobile)}>
            <section style={getSectionWrapperStyle(isMobile)}>
              <DraggableSection color="blue" static>
                <h3 style={{ fontWeight: 'bold', fontSize: '24px', color: '#5398c9' }}>Community Code</h3>
                <p><strong>For people who care about people</strong><br />
                  Your group chat isn't a start-up. It's a community, and every community has its own
                  unique needs. So why should you rely on one-sized-fits-all apps made by people who
                  care more about shareholders than stakeholders? Infinitely remixable, small-scale
                  software made for the people you love: that's the vibe.
                </p>

                <h3 style={{ fontWeight: 'bold', fontSize: '24px', color: '#5398c9' }}>The App to End all Apps</h3>
                <p><strong>What you need and nothing else</strong><br />
                  Vibes is every app you could ever need in one place — with no app store, no
                  downloads, and no software updates. It's a tool for building what you need, only when
                  you need it. Share your creations instantly with the group chat and mix them up
                  together. Best of all, everyone's data stays local, portable, and safe.
                </p>

                <h3 style={{ fontWeight: 'bold', fontSize: '24px', color: '#5398c9' }}>Get off the Cloud</h3>
                <p><strong>With un-hackable architecture</strong><br />
                  Vibes gives you complete visibility and control over your data. Your community apps
                  are stored locally, right on your phone — so you don't have to worry about trusting
                  everyone's personal information to some impersonal cloud.
                </p>

                <h3 style={{ fontWeight: 'bold', fontSize: '24px', color: '#5398c9' }}>Single-Serving Software</h3>
                <p><strong>Don't overthink it — make it.</strong><br />
                  No need to be precious. Whip up a one-time scoring app for your annual pumpkin
                  carving contest. Generate questions for trivia night. Troll your friends with a custom
                  meme template. Solve small problems or big ones. Make new things and put them into
                  motion right away. As long as you can describe it, you can build it — fast.
                </p>

                <h3 style={{ fontWeight: 'bold', fontSize: '24px', color: '#5398c9' }}>Quick Apps for Lasting Community</h3>
                <p><strong>Because good software makes good neighbors</strong><br />
                  Your relationships are always evolving. Your tools should too. With Vibes, build exactly
                  what your community needs right now. When those tools don't serve you anymore,
                  make some new ones. Because it's not about the apps. It's about what you do with
                  them together.
                </p>
              </DraggableSection>
            </section>

            <section style={getSectionWrapperStyle(isMobile)}>
              <DraggableSection color="red" static>
                <div style={getSecondCardStyle()}>
                  <p>You love your group chat. Meet your group app. </p><p>
                    Remember that camping trip when nobody packed coffee? The Friendsgiving with six
                    mac n' cheeses and no turkey? You love your friends, but organizing them can be a
                    headache. Make planning painless with custom community apps, made by and for
                    your friends, for everything you do together.</p><p>
                    Like volunteer sign-ups and school drop-offs. Project checklists and vacation planners.
                    Pick-up basketball schedules and fantasy football rankings. A cooperative chore wheel
                    for the roomies and the ultimate Oscars bracket for movie club. Whatever the vibe, you
                    can build it with Vibes.</p><p>
                    Share and use your new apps instantly, and remix them on the fly. Everyone's ideas are
                    welcome and everyone's data is protected. This is software that communities build
                    together in real time — to make life easier, fairer, and more fun for everyone.</p><p>
                    You and your friends aren't users anymore. You're makers.
                  </p>
                </div>
              </DraggableSection>
            </section>
          </div>
        </div>
    </div>
    </div>
  );
}
