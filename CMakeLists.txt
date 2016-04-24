CMAKE_MINIMUM_REQUIRED(VERSION 2.8)

project(behavior_engine)

add_definitions(-std=c++11)
set(CMAKE_C_COMPILER clang)
set(CMAKE_CXX_COMPILER clang++)
set(CMAKE_EXPORT_COMPILE_COMMANDS 1)

add_executable(behavior_engine_test
  example.cpp
)
