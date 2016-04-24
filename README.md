# Behavior engine based on the Infinite Axis Utility System

[Building a Better Centaur: AI at Massive Scale][centaur-video] presents the behavior engine that is used for the agents in "Guild Wars 2: Heart of Thorns".  They call this system the "Infinite Axis Utility System", because the engine selects along a (possibly) infinite number of "axis" the one with the highest utility score, and execute its corresponding action.  

At first this engine looks radically different from classical behavior specification languages and their corresponding engines, such as [XABSL][XABSL] which models behavior as a finite state machine.  However, I believe that there is no theoretical difference in their expressiveness (no proof yet), but the advantage should be within the field of usability: there should always be an axis with a higher utility score than others, and thus your agent always knows which action to perform.

This implementation is based on the talk, but does not aim to reproduce it exactly.  The application of this implementation is currently targeted at [RoboCup Standard Platform League][robocup-spl] soccer playing robots, especially targeted on the usability for the [Dutch Nao Team][dnt].

[centaur-video]: http://www.gdcvault.com/play/1021848/Building-a-Better-Centaur-AI "Building a Better Centaur: AI at Massive Scale"
[XABSL]: http://www.xabsl.de/ "The Extensible Agent Behavior Specification Language"
[robocup-spl]: http://www.informatik.uni-bremen.de/spl/bin/view/Website/WebHome "RoboCup Standard Platform League"
[dnt]: https://www.dutchnaoteam.nl/ "Dutch Nao Team"
