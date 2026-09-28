package com.shf.mynetty.test;


import com.shf.mynetty.server.service.HelloService;
import com.shf.mynetty.server.service.ServicesFactory;

public class TestServicesFactory {
    public static void main(String[] args) {
        HelloService service = ServicesFactory.getService(HelloService.class);
        System.out.println(service.sayHello("hi"));
    }
}
