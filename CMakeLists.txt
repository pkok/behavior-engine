CMAKE_MINIMUM_REQUIRED(VERSION 2.8)

project(behavior_engine)

set(CMAKE_CXX_COMPILER clang++)
set(CMAKE_CXX_STANDARD 11)
set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -Weverything -Wno-c++98-compat")

set(CMAKE_BUILD_TYPE Debug)
add_executable(behavior_engine_test
  example.cpp
)
