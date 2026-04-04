#ifndef STORAGE_H
#define STORAGE_H

#include <nvs.h>
#include <nvs_flash.h>
#include "server.h"
#include "Config.h"
    
void initStorage();
void loadDataFromRom();
void saveAllConfig(); // save everything to NVS

#endif