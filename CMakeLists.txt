CMAKE_MINIMUM_REQUIRED(VERSION 2.8)

project(behavior_engine)

set(CMAKE_CXX_STANDARD 11)
set(CMAKE_CXX_COMPILER clang++)
set(CMAKE_EXPORT_COMPILE_COMMANDS ON)

add_executable(behavior_engine_test
  example.cpp
)
