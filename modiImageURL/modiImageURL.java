package modiImageURL;

import java.util.Scanner;

public class modiImageURL {
    private static String addToFrontString="/assets/";

    /**
     * 这个方法用两次正则表达式将md文件中的形如
     * “![image-20220901114951631](MyBatis.assets/image-20220901114951631.png)”或
     * “<img src="MyBatis.assets/image-20240813010336984.png" alt="image-20240813010336984" style="zoom:50%;" />”
     * 修改为正确的路径
     * @param s md文件（字符串形式）
     * @return 图片可以被正确读取的md
     */
    private static String modString(String s){
        String modifiedString = s.replaceAll("\\(([^)]+\\.(png|jpg))\\)", "(" + addToFrontString + "$1"+")"); 
        String modifiedString2 = modifiedString.replaceAll("<img src=\"(.*)\"(.*)>" ,"<img src=\""+addToFrontString+"$1"+"\">");
        
        return modifiedString2;
    }

    public static void main(String[] args) {  
        Scanner scanner = new Scanner(System.in);  
        StringBuilder oriMdBuilder = new StringBuilder();  
                
        System.out.println("请输入原始字符串 (换行输入 'END' 来结束输入):");  
        
        // 循环读取用户输入，直到用户输入 'END'  
        while (true) {  
            String line = scanner.nextLine();  // 读取一行输入  
            if (line.equals("END")) {  
                break; // 如果输入的是 'END'，则结束循环  
            }  
            oriMdBuilder.append(line).append("\n"); // 将输入的行添加到 StringBuilder 中  
        }  
        
        // 将 StringBuilder 转换成 String  
        String oriMd = oriMdBuilder.toString();  
        
        // 调用 modString 方法处理 oriMd  
        String newMd = modString(oriMd);  
        
        // 打印处理后的字符串  
        System.out.println("处理后的字符串:");  
        System.out.println(newMd);  
        
        // 关闭扫描器  
        scanner.close();  
    }  
}